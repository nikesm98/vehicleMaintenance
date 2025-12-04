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
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    try:
        token = authorization.replace("Bearer ", "")
        
        # Get JWKS from Clerk
        # Extract the domain from publishable key
        # pk_test_bm9ybWFsLXR1cmtleS0xNy5jbGVyay5hY2NvdW50cy5kZXYk
        # Base64 decode: normal-turkey-17.clerk.accounts.dev
        import base64
        pk_data = CLERK_PUBLISHABLE_KEY.replace('pk_test_', '').replace('pk_live_', '')
        # Add padding if needed
        padding = 4 - len(pk_data) % 4
        if padding != 4:
            pk_data += '=' * padding
        clerk_domain = base64.b64decode(pk_data).decode('utf-8')
        
        jwks_url = f"https://{clerk_domain}/.well-known/jwks.json"
        
        # Fetch JWKS
        async with httpx.AsyncClient() as client:
            response = await client.get(jwks_url)
            jwks = response.json()
        
        # Get the key
        headers = jwt.get_unverified_header(token)
        kid = headers.get('kid')
        
        # Find matching key
        key = None
        for k in jwks.get('keys', []):
            if k.get('kid') == kid:
                key = k
                break
        
        if not key:
            raise HTTPException(status_code=401, detail="Unable to find appropriate key")
        
        # Build RSA public key from JWK
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
        user_id = payload.get('sub', '')
        email = payload.get('email', '') or payload.get('primary_email_address', '')
        full_name = payload.get('name', '') or payload.get('full_name', '')
        
        # If email/name not in token, we might need to fetch from Clerk API
        if not email or not full_name:
            # Use session claims
            email = email or payload.get('email_addresses', [{}])[0].get('email_address', '') if isinstance(payload.get('email_addresses'), list) else ''
            full_name = full_name or f"{payload.get('first_name', '')} {payload.get('last_name', '')}".strip()
        
        return UserInfo(
            user_id=user_id,
            email=email or 'unknown@email.com',
            full_name=full_name or 'Unknown User'
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
    """Return list of 65 vehicle numbers"""
    vehicles = []
    prefixes = ["DL", "HR", "UP", "RJ", "PB"]
    for i, prefix in enumerate(prefixes):
        for j in range(1, 14):
            num = (i * 13) + j
            vehicles.append(f"{prefix}{str(j).zfill(2)}XX{str(1000 + num)}")
    return {"vehicles": vehicles[:65]}

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
                        }
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
