from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import httpx
import jwt
from jwt import PyJWKClient
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'fleet_maintenance_db')]

# Clerk configuration
CLERK_SECRET_KEY = os.environ.get('CLERK_SECRET_KEY', '')
CLERK_PUBLISHABLE_KEY = os.environ.get('CLERK_PUBLISHABLE_KEY', '')
USE_GOOGLE_SHEETS = os.environ.get('USE_GOOGLE_SHEETS', 'false').lower() == 'true'
GOOGLE_APPS_SCRIPT_URL = os.environ.get('GOOGLE_APPS_SCRIPT_URL', '')

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Pydantic Models
class TyreInfo(BaseModel):
    position: str
    number: str
    photo_base64: Optional[str] = None
    photo_link: Optional[str] = None

class VehicleImage(BaseModel):
    position: str  # front, left, right, rear
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
    prime_tyres: List[TyreInfo] = []
    trailer_tyres: List[TyreInfo] = []
    vehicle_images: List[VehicleImage] = []

class MaintenanceLog(BaseModel):
    record_id: str
    timestamp: str
    vehicle_number: str
    battery1_number: str
    battery1_photo_link: Optional[str] = None
    battery2_number: str
    battery2_photo_link: Optional[str] = None
    prime_tyres: List[Dict[str, Any]] = []
    trailer_tyres: List[Dict[str, Any]] = []
    vehicle_images: List[Dict[str, Any]] = []
    created_by: UserInfo

class MaintenanceSubmitResponse(BaseModel):
    success: bool
    message: str
    record_id: str

# Clerk JWT verification
async def verify_clerk_token(authorization: Optional[str] = Header(None)) -> UserInfo:
    # -------------------------------------------------------------
    # BYPASS MODE (Local Development)
    # -------------------------------------------------------------
    # if os.getenv("SKIP_AUTH", "false").lower() == "true":
    #     return UserInfo(
    #         user_id="dev-user",
    #         email="dev@example.com",
    #         full_name="Developer Mode"
    #     )
    
    # # -------------------------------------------------------------
    # # HARDCODED TEST TOKEN (manually bypass)
    # # -------------------------------------------------------------
    # TEST_TOKEN = "Bearer eyJhbGciOiJSUzI1NiIsImN..."
    # if authorization == TEST_TOKEN:
    #     return UserInfo(
    #         user_id='nikesm',
    #         email='nikesm9818@gmail.com',
    #         full_name='Nikhil Singh Mahara'
    #     )

    # -------------------------------------------------------------
    # NORMAL VERIFICATION
    # -------------------------------------------------------------
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")

    try:
        token = authorization.replace("Bearer ", "")

        # Clerk domain comes directly from .env
        clerk_domain = os.getenv("CLERK_DOMAIN")
        if not clerk_domain:
            raise HTTPException(status_code=500, detail="CLERK_DOMAIN not configured")

        jwks_url = f"https://{clerk_domain}/.well-known/jwks.json"

        # Fetch JWKS
        async with httpx.AsyncClient() as client:
            response = await client.get(jwks_url)
            jwks = response.json()

        # Get header
        headers = jwt.get_unverified_header(token)
        kid = headers.get('kid')

        # Find matching key
        key = None
        for k in jwks.get('keys', []):
            if k.get('kid') == kid:
                key = k
                break

        if not key:
            raise HTTPException(status_code=401, detail="Unable to find matching JWK key")

        # Build public key
        from jwt.algorithms import RSAAlgorithm
        public_key = RSAAlgorithm.from_jwk(json.dumps(key))

        # Verify token
        payload = jwt.decode(
            token,
            public_key,
            algorithms=['RS256'],
            options={"verify_aud": False}
        )

        # Extract user info
        user_id = payload.get('user_id')
        email = payload.get('email')
        full_name = payload.get('full_name')
        # fallback fields
        if not user_id:
            user_id = payload.get("sub")
        if not email:
            emails = payload.get("email_addresses", [])
            if isinstance(emails, list) and emails:
                email = emails[0].get("email_address", "")

        if not full_name:
            first = payload.get("first_name", "")
            last = payload.get("last_name", "")
            full_name = f"{first} {last}".strip()

        return UserInfo(
            user_id=user_id,
            email=email or "unknown@example.com",
            full_name=full_name or "Unknown User"
        )

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")

    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

# Routes
@api_router.get("/")
async def root():
    return {"message": "CJ Darcl Fleet Maintenance API"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "use_google_sheets": USE_GOOGLE_SHEETS}

@api_router.get("/vehicles")
async def get_vehicles():
    """Return fixed list of 65 vehicle numbers"""
    vehicles = [
        "HR55AZ3114", "HR55AP7119", "HR55AP1908", "HR55AP5443", "HR55AP3537",
        "HR55AP9057", "HR55AP1181", "HR55AP6189", "HR55AP8302", "HR55AP3538",
        "HR55AP2933", "HR55AP9013", "HR55AP4716", "HR55AP6982", "HR55AP1569",
        "HR55AP7671", "HR55AP3523", "HR55AP0407", "HR55AP0740", "HR55AP7396",
        "HR55AP1657", "HR55AR2073", "HR55AR1287", "HR55AR4913", "HR55AR3298",
        "HR55AR2616", "HR55AR1698", "HR55AR4395", "HR55AR4507", "HR55AR2561",
        "HR55AR7377", "NL01AE4999", "NL01AE4997", "NL01AE4995", "NL01AE4993",
        "NL01AE4991", "NL01AE4989", "NL01AE4987", "NL01AE4985", "NL01AE4983",
        "NL01AE4981", "NL01AE4979", "NL01AE4975", "NL01AE4973", "NL01AE4971",
        "NL01AE4969", "NL01AE4967", "NL01AE4965", "NL01AE4963", "NL01AE4961",
        "NL01AE4959", "NL01AE4957", "NL01AE4955", "NL01AE4953", "NL01AE4951",
        "NL01AD6494", "NL01AD4558", "NL01AD4557", "NL01AD4556", "NL01AD4444",
        "NL01AD4443", "NL01AD4442", "NL01AD4441", "NL01AD4440", "NL01AE4977",
    ]

    return {"vehicles": vehicles}


@api_router.post("/maintenance/submit", response_model=MaintenanceSubmitResponse)
async def submit_maintenance(request: MaintenanceSubmitRequest, user: UserInfo = Depends(verify_clerk_token)):
    """Submit a maintenance log"""
    try:
        record_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Prepare data
        log_data = {
            "record_id": record_id,
            "timestamp": timestamp,
            "vehicle_number": request.vehicle_number,
            "battery1_number": request.battery1_number,
            "battery1_photo_base64": request.battery1_photo_base64,
            "battery1_photo_link": None,
            "battery2_number": request.battery2_number,
            "battery2_photo_base64": request.battery2_photo_base64,
            "battery2_photo_link": None,
            "prime_tyres": [t.model_dump() for t in request.prime_tyres],
            "trailer_tyres": [t.model_dump() for t in request.trailer_tyres],
            "vehicle_images": [v.model_dump() for v in request.vehicle_images],
            "created_by_user_id": user.user_id,
            "created_by_email": user.email,
            "created_by_name": user.full_name,
            "synced_to_sheets": False
        }
        
        if USE_GOOGLE_SHEETS and GOOGLE_APPS_SCRIPT_URL:
            # Send to Google Apps Script
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    apps_script_response = await client.post(
                        GOOGLE_APPS_SCRIPT_URL,
                        json={
                            "action": "submit",
                            "data": log_data
                        },
                        headers={"Content-Type": "application/json"}
                    )
                    result = apps_script_response.json()
                    if result.get("success"):
                        log_data["synced_to_sheets"] = True
                        # Update with image links from Apps Script
                        log_data["battery1_photo_link"] = result.get("battery1_photo_link")
                        log_data["battery2_photo_link"] = result.get("battery2_photo_link")
                        if result.get("prime_tyre_links"):
                            for i, link in enumerate(result["prime_tyre_links"]):
                                if i < len(log_data["prime_tyres"]):
                                    log_data["prime_tyres"][i]["photo_link"] = link
                        if result.get("trailer_tyre_links"):
                            for i, link in enumerate(result["trailer_tyre_links"]):
                                if i < len(log_data["trailer_tyres"]):
                                    log_data["trailer_tyres"][i]["photo_link"] = link
                        if result.get("vehicle_image_links"):
                            for i, link in enumerate(result["vehicle_image_links"]):
                                if i < len(log_data["vehicle_images"]):
                                    log_data["vehicle_images"][i]["photo_link"] = link
            except Exception as e:
                logger.error(f"Failed to sync to Google Sheets: {e}")
                # Continue with MongoDB storage
        
        # Always save to MongoDB (as primary or fallback)
        # Remove base64 data before storing (to save space)
        store_data = log_data.copy()
        store_data.pop("battery1_photo_base64", None)
        store_data.pop("battery2_photo_base64", None)
        for tyre in store_data.get("prime_tyres", []):
            tyre.pop("photo_base64", None)
        for tyre in store_data.get("trailer_tyres", []):
            tyre.pop("photo_base64", None)
        for img in store_data.get("vehicle_images", []):
            img.pop("photo_base64", None)
        
        await db.maintenance_logs.insert_one(store_data)
        
        return MaintenanceSubmitResponse(
            success=True,
            message="Maintenance log saved successfully",
            record_id=record_id
        )
        
    except Exception as e:
        logger.error(f"Error submitting maintenance log: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/maintenance/logs")
async def get_maintenance_logs(
    vehicle: Optional[str] = None,
    user: UserInfo = Depends(verify_clerk_token)
):
    """Get all maintenance logs with optional vehicle filter"""
    try:
        query = {}
        if vehicle:
            query["vehicle_number"] = {"$regex": vehicle, "$options": "i"}
        
        logs = await db.maintenance_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(1000)
        
        # Transform data for response
        result = []
        for log in logs:
            result.append({
                "record_id": log.get("record_id"),
                "timestamp": log.get("timestamp"),
                "vehicle_number": log.get("vehicle_number"),
                "battery1_number": log.get("battery1_number"),
                "battery1_photo_link": log.get("battery1_photo_link"),
                "battery2_number": log.get("battery2_number"),
                "battery2_photo_link": log.get("battery2_photo_link"),
                "prime_tyres": log.get("prime_tyres", []),
                "trailer_tyres": log.get("trailer_tyres", []),
                "vehicle_images": log.get("vehicle_images", []),
                "created_by": {
                    "user_id": log.get("created_by_user_id"),
                    "email": log.get("created_by_email"),
                    "name": log.get("created_by_name")
                },
                "synced_to_sheets": log.get("synced_to_sheets", False)
            })
        
        return {"logs": result}
        
    except Exception as e:
        logger.error(f"Error fetching maintenance logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/maintenance/logs/{record_id}")
async def get_maintenance_log(record_id: str, user: UserInfo = Depends(verify_clerk_token)):
    """Get a specific maintenance log by ID"""
    try:
        log = await db.maintenance_logs.find_one({"record_id": record_id}, {"_id": 0})
        if not log:
            raise HTTPException(status_code=404, detail="Log not found")
        
        return {
            "record_id": log.get("record_id"),
            "timestamp": log.get("timestamp"),
            "vehicle_number": log.get("vehicle_number"),
            "battery1_number": log.get("battery1_number"),
            "battery1_photo_link": log.get("battery1_photo_link"),
            "battery2_number": log.get("battery2_number"),
            "battery2_photo_link": log.get("battery2_photo_link"),
            "prime_tyres": log.get("prime_tyres", []),
            "trailer_tyres": log.get("trailer_tyres", []),
            "vehicle_images": log.get("vehicle_images", []),
            "created_by": {
                "user_id": log.get("created_by_user_id"),
                "email": log.get("created_by_email"),
                "name": log.get("created_by_name")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching maintenance log: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
