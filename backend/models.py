from pydantic import BaseModel
from typing import List, Optional

class TyreInfo(BaseModel):
    position: str
    number: str = ""
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
    battery1_number: str = ""
    battery1_photo_base64: Optional[str] = None
    battery2_number: str = ""
    battery2_photo_base64: Optional[str] = None
    odometer_value: Optional[str] = None
    odometer_photo_base64: Optional[str] = None
    prime_tyres: List[TyreInfo] = []
    trailer_tyres: List[TyreInfo] = []
    vehicle_images: List[VehicleImage] = []

class MaintenanceSubmitResponse(BaseModel):
    success: bool
    message: str
    record_id: str