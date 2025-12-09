# server.py
import os
import uuid
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import httpx
import jwt

# Load .env immediately so google_sync and other modules can read env vars
from dotenv import load_dotenv

load_dotenv()

# Local imports (google_sync uses env vars, so dotenv must be loaded first)
from models import MaintenanceSubmitRequest, MaintenanceSubmitResponse, UserInfo
from google_sync import upload_base64_image, append_row_to_sheet, read_sheet_logs

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ENVIRONMENT
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "fleet_maintenance_db")
USE_GOOGLE_SHEETS = os.environ.get("USE_GOOGLE_SHEETS", "false").lower() == "true"

CLERK_DOMAIN = os.environ.get("CLERK_DOMAIN")
CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY")

if not MONGO_URL:
    raise RuntimeError("MONGO_URL not set")

# Mongo client
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# FastAPI & Router
app = FastAPI()
api = APIRouter(prefix="/api")

# Hardcoded vehicles list (same as before)
VEHICLES = [
    "HR55AZ3114", "NL01AE4999", "NL01AE4997", "NL01AE4995", "NL01AE4993",
    "NL01AE4991", "NL01AE4989", "NL01AE4987", "NL01AE4985", "NL01AE4983",
    "NL01AE4981", "NL01AE4979", "NL01AE4975", "NL01AE4973", "NL01AE4971",
    "NL01AE4969", "NL01AE4967", "NL01AE4965", "NL01AE4963", "NL01AE4961",
    "NL01AE4959", "NL01AE4957", "NL01AE4955", "NL01AE4953", "NL01AE4951",
    "NL01AD6494", "NL01AD4558", "NL01AD4557", "NL01AD4556", "NL01AD4444",
    "NL01AD4443", "NL01AD4442", "NL01AD4441", "NL01AD4440", "NL01AE4977",
    "HR55AP7119", "HR55AP1908", "HR55AP5443", "HR55AP3537", "HR55AP9057",
    "HR55AP1181", "HR55AP6189", "HR55AP8302", "HR55AP3538", "HR55AP2933",
    "HR55AP9013", "HR55AP4716", "HR55AP6982", "HR55AP1569", "HR55AP7671",
    "HR55AP3523", "HR55AP0407", "HR55AP0740", "HR55AP7396", "HR55AP1657",
    "HR55AR2073", "HR55AR1287", "HR55AR4913", "HR55AR3298", "HR55AR2616",
    "HR55AR1698", "HR55AR4395", "HR55AR4507", "HR55AR2561", "HR55AR7377"
]


# ---------------------------
# Clerk token verification
# ---------------------------
async def verify_clerk_token(authorization: Optional[str] = Header(None)) -> UserInfo:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")

    token = authorization.replace("Bearer ", "")

    if not CLERK_DOMAIN:
        raise HTTPException(status_code=500, detail="CLERK_DOMAIN missing")

    jwks_url = f"https://{CLERK_DOMAIN}/.well-known/jwks.json"

    try:
        async with httpx.AsyncClient() as client:
            jwks = (await client.get(jwks_url)).json()

        headers = jwt.get_unverified_header(token)
        kid = headers.get("kid")

        key = next((k for k in jwks["keys"] if k["kid"] == kid), None)
        if not key:
            raise HTTPException(status_code=401, detail="Invalid token key")

        from jwt.algorithms import RSAAlgorithm
        public_key = RSAAlgorithm.from_jwk(json.dumps(key))

        payload = jwt.decode(
            token, public_key, algorithms=["RS256"], options={"verify_aud": False}
        )

        user_id = payload.get("sub")

        # fetch user profile
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"https://api.clerk.dev/v1/users/{user_id}",
                headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"},
            )

        if res.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to fetch user")

        user_data = res.json()

        email = user_data.get("email_addresses", [{}])[0].get("email_address", "")
        full_name = f"{user_data.get('first_name','')} {user_data.get('last_name','')}".strip()

        return UserInfo(user_id=user_id, email=email, full_name=full_name)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Token verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------------
# Helpers: parse sheet columns into JSON shape
# ---------------------------
def _parse_readable_list(readable_str: str):
    """Parse newline-separated 'Position: Number' into list of {position, number}"""
    if not readable_str:
        return []
    lines = [ln.strip() for ln in str(readable_str).split("\n") if ln.strip()]
    out = []
    for line in lines:
        if ":" in line:
            pos, num = line.split(":", 1)
            out.append({"position": pos.strip(), "number": num.strip()})
        else:
            out.append({"position": line, "number": ""})
    return out


def _parse_links_list_as_strings(links_str: str):
    """Parse newline-separated 'Position: link' into list of {position, photo_link} (photo_link = '' when missing)"""
    if not links_str:
        return []
    lines = [ln.strip() for ln in str(links_str).split("\n") if ln.strip()]
    out = []
    for line in lines:
        parts = line.split(": ", 1) if ": " in line else line.split(":", 1)
        if len(parts) == 2:
            pos, link = parts[0].strip(), parts[1].strip()
            if link == "(no photo)" or link == "" or link is None:
                link = ""
            out.append({"position": pos, "photo_link": link})
        else:
            out.append({"position": parts[0].strip(), "photo_link": ""})
    return out


def sheet_row_to_json(row: dict) -> dict:
    """
    Convert a Google Sheet row (header->value dict) into your original Mongo-like JSON shape.
    Produces both the canonical arrays and the separate *_links arrays and `created_by` nested object.
    """
    get = lambda *keys: next((row.get(k) for k in keys if row.get(k) is not None), "")

    record_id = get("Record ID", "record_id")
    timestamp = get("Timestamp", "timestamp")
    vehicle_number = get("Vehicle Number", "vehicle_number")

    # battery / odometer
    battery1_number = get("Battery1 Number", "Battery 1 Number", "battery1_number") or ""
    battery1_photo_link = get("Battery1 Image Link", "Battery1 Photo Link", "battery1_photo_link") or ""
    battery2_number = get("Battery2 Number", "Battery 2 Number", "battery2_number") or ""
    battery2_photo_link = get("Battery2 Image Link", "Battery2 Photo Link", "battery2_photo_link") or ""
    odometer_value = get("Odometer Value", "odometer_value") or ""
    odometer_photo_link = get("Odometer Image Link", "Odometer Image Link", "odometer_photo_link") or ""

    # Tyre readable and links (sheet columns)
    prime_readable_col = get("Prime Tyres (Readable)", "Prime Tyres (Readable)", "Prime Tyres", "")
    prime_links_col = get("Prime Tyre Links", "Prime Tyre Links", "")  # separate links column

    trailer_readable_col = get("Trailer Tyres (Readable)", "Trailer Tyres (Readable)", "")
    trailer_links_col = get("Trailer Tyre Links", "Trailer Tyre Links", "")

    # Vehicle images columns
    vehicle_readable_col = get("Vehicle Images (Readable)", "Vehicle Images (Readable)", "Vehicle Images", "")
    vehicle_links_col = get("Vehicle Image Links", "Vehicle Image Links", "")

    # Created by columns (both flat and nested)
    created_by_user_id = get("CreatedBy_userId", "CreatedBy_userId", "created_by_user_id") or ""
    created_by_email = get("CreatedBy_email", "CreatedBy_email", "created_by_email") or ""
    created_by_name = get("CreatedBy_name", "CreatedBy_name", "created_by_name") or ""

    # Parse readable -> arrays
    prime_tyres = _parse_readable_list(prime_readable_col)
    trailer_tyres = _parse_readable_list(trailer_readable_col)
    vehicle_images = _parse_readable_list(vehicle_readable_col)

    # Parse links -> arrays (strings, '' when missing)
    prime_tyre_links = _parse_links_list_as_strings(prime_links_col)
    trailer_tyre_links = _parse_links_list_as_strings(trailer_links_col)
    vehicle_image_links = _parse_links_list_as_strings(vehicle_links_col)

    # Build nested created_by
    created_by = {
        "user_id": created_by_user_id,
        "email": created_by_email,
        "name": created_by_name,
    }

    # Final object — keep both the separate link arrays (legacy) and the canonical arrays
    return {
        "record_id": record_id,
        "timestamp": timestamp,
        "vehicle_number": vehicle_number,
        "battery1_number": battery1_number,
        "battery1_photo_link": battery1_photo_link,
        "battery2_number": battery2_number,
        "battery2_photo_link": battery2_photo_link,
        "odometer_value": odometer_value,
        "odometer_photo_link": odometer_photo_link,
        "prime_tyres": prime_tyres,                 # [{position, number}, ...]
        "prime_tyre_links": prime_tyre_links,       # [{position, photo_link}, ...]
        "trailer_tyres": trailer_tyres,
        "trailer_tyre_links": trailer_tyre_links,
        "vehicle_images": vehicle_images,           # [{position, number}, ...]
        "vehicle_image_links": vehicle_image_links, # [{position, photo_link}, ...]
        "created_by": created_by,
        "created_by_user_id": created_by_user_id,
        "created_by_email": created_by_email,
        "created_by_name": created_by_name,
        "synced_to_sheets": True,
    }


# ---------------------------
# Routes
# ---------------------------
@api.get("/vehicles")
async def get_vehicles():
    return {"vehicles": VEHICLES}


@api.post("/maintenance/submit", response_model=MaintenanceSubmitResponse)
async def submit_maintenance(request: MaintenanceSubmitRequest, user: UserInfo = Depends(verify_clerk_token)):
    try:
        record_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()

        log_data = {
            "record_id": record_id,
            "timestamp": timestamp,
            "vehicle_number": request.vehicle_number,
            "battery1_number": request.battery1_number,
            "battery1_photo_link": None,
            "battery2_number": request.battery2_number,
            "battery2_photo_link": None,
            "odometer_value": request.odometer_value,
            "odometer_photo_link": None,
            "prime_tyres": [t.model_dump() for t in request.prime_tyres],
            "trailer_tyres": [t.model_dump() for t in request.trailer_tyres],
            "vehicle_images": [v.model_dump() for v in request.vehicle_images],
            "created_by_user_id": user.user_id,
            "created_by_email": user.email,
            "created_by_name": user.full_name,
            "synced_to_sheets": False,
        }

        if USE_GOOGLE_SHEETS:
            try:
                # upload main images
                battery1_link = await asyncio.to_thread(
                    upload_base64_image,
                    request.battery1_photo_base64,
                    f"battery1_{request.vehicle_number}_{record_id}.jpg",
                )
                battery2_link = await asyncio.to_thread(
                    upload_base64_image,
                    request.battery2_photo_base64,
                    f"battery2_{request.vehicle_number}_{record_id}.jpg",
                )
                odometer_link = await asyncio.to_thread(
                    upload_base64_image,
                    request.odometer_photo_base64,
                    f"odometer_{request.vehicle_number}_{record_id}.jpg",
                )

                log_data["battery1_photo_link"] = battery1_link or None
                log_data["battery2_photo_link"] = battery2_link or None
                log_data["odometer_photo_link"] = odometer_link or None

                # tyres
                prime_readable, prime_links = [], []
                for t in request.prime_tyres:
                    prime_readable.append(f"{t.position}: {t.number}")
                    if t.photo_base64:
                        link = await asyncio.to_thread(
                            upload_base64_image,
                            t.photo_base64,
                            f"prime_{request.vehicle_number}_{t.position}_{record_id}.jpg",
                        )
                        prime_links.append(f"{t.position}: {link}")
                    else:
                        prime_links.append(f"{t.position}: (no photo)")

                trailer_readable, trailer_links = [], []
                for t in request.trailer_tyres:
                    trailer_readable.append(f"{t.position}: {t.number}")
                    if t.photo_base64:
                        link = await asyncio.to_thread(
                            upload_base64_image,
                            t.photo_base64,
                            f"trailer_{request.vehicle_number}_{t.position}_{record_id}.jpg",
                        )
                        trailer_links.append(f"{t.position}: {link}")
                    else:
                        trailer_links.append(f"{t.position}: (no photo)")

                vehicle_readable, vehicle_links = [], []
                for v in request.vehicle_images:
                    vehicle_readable.append(v.position)
                    if v.photo_base64:
                        link = await asyncio.to_thread(
                            upload_base64_image,
                            v.photo_base64,
                            f"vehicle_{request.vehicle_number}_{v.position}_{record_id}.jpg",
                        )
                        vehicle_links.append(f"{v.position}: {link}")
                    else:
                        vehicle_links.append(f"{v.position}: (no photo)")

                # build row to append (matches your sheet headers)
                row = [
                    record_id,
                    timestamp,
                    request.vehicle_number,
                    request.battery1_number or "",
                    battery1_link or "",
                    request.battery2_number or "",
                    battery2_link or "",
                    request.odometer_value or "",
                    odometer_link or "",
                    "\n".join(prime_readable),
                    "\n".join(prime_links),
                    "\n".join(trailer_readable),
                    "\n".join(trailer_links),
                    "\n".join(vehicle_readable),
                    "\n".join(vehicle_links),
                    user.user_id,
                    user.email,
                    user.full_name,
                ]

                await asyncio.to_thread(append_row_to_sheet, row)
                log_data["synced_to_sheets"] = True

            except Exception as e:
                logger.exception("Google Sheets sync failed: %s", e)

        # Remove base64 before saving to Mongo
        backup = dict(log_data)
        for tyre in backup.get("prime_tyres", []):
            tyre.pop("photo_base64", None)
        for tyre in backup.get("trailer_tyres", []):
            tyre.pop("photo_base64", None)
        for img in backup.get("vehicle_images", []):
            img.pop("photo_base64", None)

        await db.maintenance_logs.insert_one(backup)

        return MaintenanceSubmitResponse(success=True, message="Log submitted", record_id=record_id)

    except Exception as e:
        logger.exception("Submit error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------
# GET LOGS: Read from Google Sheets & convert to JSON shape
# ---------------------------
@api.get("/maintenance/logs")
async def get_logs(user: UserInfo = Depends(verify_clerk_token)):
    try:
        rows = await asyncio.to_thread(read_sheet_logs)
        transformed = [sheet_row_to_json(r) for r in rows]
        return {"logs": transformed}
    except Exception as e:
        logger.exception("Error fetching logs: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch logs")


# ---------------------------
# GET SINGLE LOG: record_id or vehicle number
# ---------------------------
@api.get("/maintenance/logs/{identifier}")
async def get_single_log(identifier: str, user: UserInfo = Depends(verify_clerk_token)):
    try:
        rows = await asyncio.to_thread(read_sheet_logs)
        transformed = [sheet_row_to_json(r) for r in rows]

        # try record_id exact match
        match = next((r for r in transformed if (r.get("record_id") or "").strip() == identifier), None)
        if match:
            return match

        # fallback: treat identifier as vehicle number (substring, case-insensitive)
        matches = [r for r in transformed if identifier.lower() in (r.get("vehicle_number") or "").lower()]
        if not matches:
            raise HTTPException(status_code=404, detail="Record not found")

        return {"logs": matches}

    except Exception as e:
        logger.exception("Error fetching single log: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch log")


# Attach router & CORS
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)
