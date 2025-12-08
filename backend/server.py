from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import httpx
import jwt
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "fleet_maintenance_db")]

# Config
USE_GOOGLE_SHEETS = os.environ.get("USE_GOOGLE_SHEETS", "false").lower() == "true"
GOOGLE_APPS_SCRIPT_URL = os.environ.get("GOOGLE_APPS_SCRIPT_URL", "")
CLERK_DOMAIN = os.getenv("CLERK_DOMAIN")

# App init
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ----------------------------
# MODELS
# ----------------------------
class TyreInfo(BaseModel):
    position: str
    number: str
    photo_base64: Optional[str] = None
    photo_link: Optional[str] = None


class VehicleImage(BaseModel):
    position: str
    photo_base64: Optional[str] = None
    photo_link: Optional[str] = None


class UserInfo(BaseModel):
    user_id: str
    email: str
    full_name: str


class MaintenanceSubmitRequest(BaseModel):
    vehicle_number: str

    battery1_number: str
    battery1_photo_base64: Optional[str] = None

    battery2_number: str
    battery2_photo_base64: Optional[str] = None

    # ⭐ ADDED ODOMETER FIELDS
    odometer_value: Optional[str] = None
    odometer_photo_base64: Optional[str] = None

    prime_tyres: List[TyreInfo] = []
    trailer_tyres: List[TyreInfo] = []
    vehicle_images: List[VehicleImage] = []


class MaintenanceSubmitResponse(BaseModel):
    success: bool
    message: str
    record_id: str


# ----------------------------
# CLERK TOKEN VERIFY
# ----------------------------
async def verify_clerk_token(authorization: Optional[str] = Header(None)) -> UserInfo:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")

    try:
        token = authorization.replace("Bearer ", "")
        if not CLERK_DOMAIN:
            raise HTTPException(status_code=500, detail="CLERK_DOMAIN missing")

        jwks_url = f"https://{CLERK_DOMAIN}/.well-known/jwks.json"

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

        # Fetch user info from Clerk API
        CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")

        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"https://api.clerk.dev/v1/users/{user_id}",
                headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"},
            )

        if res.status_code != 200:
            raise Exception("Failed to fetch user profile from Clerk")

        user_data = res.json()

        email = user_data["email_addresses"][0]["email_address"]
        full_name = f"{user_data.get('first_name','')} {user_data.get('last_name','')}".strip()

        return UserInfo(user_id=user_id, email=email, full_name=full_name)

    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")


# ----------------------------
# ROUTES
# ----------------------------
@api_router.get("/vehicles")
async def get_vehicles():
    vehicles = [
        "HR55AZ3114", "HR55AP7119", "HR55AP1908", "HR55AP5443", "HR55AP3537",
        "HR55AP9057", "HR55AP1181", "HR55AP6189", "HR55AP8302", "HR55AP3538",
        "HR55AP2933", "HR55AP9013", "HR55AP4719", "HR55AP4710", "HR55AP9058",
        "HR55AP6188", "HR55AP2934", "HR55AP7111", "HR55AP1182", "HR55AP5444",
        "HR55AP8310", "HR55AP3539", "HR55AP9059", "HR55AP1909", "HR55AP7112",
        "HR55AP8308", "HR55AP8309", "HR55AP3536", "HR55AP3535", "HR55AP5442",
        "HR55AP5441", "HR55AP5440", "HR55AP2930", "HR55AP2931", "HR55AP2932",
        "HR55AP7113", "HR55AP7114", "HR55AP7115", "HR55AP7116", "HR55AP7117",
        "HR55AP7118", "HR55AP7120", "HR55AP7121", "HR55AP7122", "HR55AP7123",
        "HR55AP7124", "HR55AP7125", "HR55AP7126", "HR55AP7127", "HR55AP7128",
        "HR55AP7129", "HR55AP7130", "HR55AP7131", "HR55AP7132", "HR55AP7133",
        "HR55AP7134", "HR55AP7135", "HR55AP7136", "HR55AP7137", "HR55AP7138",
        "HR55AP7139", "HR55AP7140", "HR55AP7141", "HR55AP7142",
    ]
    return {"vehicles": vehicles}


# ----------------------------
# SUBMIT MAINTENANCE LOG
# ----------------------------
@api_router.post("/maintenance/submit", response_model=MaintenanceSubmitResponse)
async def submit_maintenance(
    request: MaintenanceSubmitRequest, user: UserInfo = Depends(verify_clerk_token)
):
    try:
        record_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()

        # ----------------------------
        # BUILD DATA PACKET FOR SHEETS
        # ----------------------------
        log_data = {
            "record_id": record_id,
            "timestamp": timestamp,
            "vehicle_number": request.vehicle_number,

            "battery1_number": request.battery1_number,
            "battery1_photo_base64": request.battery1_photo_base64,

            "battery2_number": request.battery2_number,
            "battery2_photo_base64": request.battery2_photo_base64,

            # ⭐ FIXED — ODOMETER FIELDS INCLUDED
            "odometer_value": request.odometer_value,
            "odometer_photo_base64": request.odometer_photo_base64,

            "prime_tyres": [t.model_dump() for t in request.prime_tyres],
            "trailer_tyres": [t.model_dump() for t in request.trailer_tyres],
            "vehicle_images": [v.model_dump() for v in request.vehicle_images],

            "created_by_user_id": user.user_id,
            "created_by_email": user.email,
            "created_by_name": user.full_name,

            "synced_to_sheets": False,
        }

        # ----------------------------
        # SEND TO GOOGLE SHEETS
        # ----------------------------
        if USE_GOOGLE_SHEETS and GOOGLE_APPS_SCRIPT_URL:
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.post(
                        GOOGLE_APPS_SCRIPT_URL,
                        json={"action": "submit", "data": log_data},
                        headers={"Content-Type": "application/json"},
                        follow_redirects=True,
                    )

                result = resp.json()

                if result.get("success"):
                    log_data["synced_to_sheets"] = True
                    log_data["battery1_photo_link"] = result.get("battery1_photo_link")
                    log_data["battery2_photo_link"] = result.get("battery2_photo_link")
                    log_data["odometer_photo_link"] = result.get("odometer_photo_link")

            except Exception as e:
                logger.error(f"Sheets sync failed: {e}")

        # ----------------------------
        # CLEANUP BEFORE SAVING TO MONGO
        # ----------------------------
        backup = log_data.copy()

        # Remove base64 images
        backup.pop("battery1_photo_base64", None)
        backup.pop("battery2_photo_base64", None)
        backup.pop("odometer_photo_base64", None)

        for tyre in backup.get("prime_tyres", []):
            tyre.pop("photo_base64", None)

        for tyre in backup.get("trailer_tyres", []):
            tyre.pop("photo_base64", None)

        for img in backup.get("vehicle_images", []):
            img.pop("photo_base64", None)

        await db.maintenance_logs.insert_one(backup)

        return MaintenanceSubmitResponse(
            success=True,
            message="Log submitted",
            record_id=record_id,
        )

    except Exception as e:
        logger.error(f"Submit error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------
# FETCH ALL LOGS (Sheets only)
# ----------------------------
@api_router.get("/maintenance/logs")
async def get_logs(vehicle: Optional[str] = None, user: UserInfo = Depends(verify_clerk_token)):
    if not GOOGLE_APPS_SCRIPT_URL:
        raise HTTPException(500, "GOOGLE_APPS_SCRIPT_URL missing")

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(f"{GOOGLE_APPS_SCRIPT_URL}?action=fetch", follow_redirects=True)

        data = json.loads(resp.text.strip())
        logs = data.get("logs", [])

        if vehicle:
            logs = [l for l in logs if vehicle.lower() in l["vehicle_number"].lower()]

        return {"logs": logs}

    except Exception as e:
        logger.error(f"Fetch logs error: {e}")
        raise HTTPException(500, str(e))


# ----------------------------
# FETCH A SINGLE LOG
# ----------------------------
@api_router.get("/maintenance/logs/{record_id}")
async def get_single_log(record_id: str, user: UserInfo = Depends(verify_clerk_token)):
    if not GOOGLE_APPS_SCRIPT_URL:
        raise HTTPException(500, "GOOGLE_APPS_SCRIPT_URL missing")

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(f"{GOOGLE_APPS_SCRIPT_URL}?action=fetch", follow_redirects=True)

        logs = json.loads(resp.text.strip()).get("logs", [])

        match = next((l for l in logs if l["record_id"] == record_id), None)
        if not match:
            raise HTTPException(404, f"Record {record_id} not found")

        return match

    except Exception as e:
        logger.error(f"Fetch record error: {e}")
        raise HTTPException(500, str(e))


# Attach router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
