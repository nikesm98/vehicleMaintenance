# API Contract

## Base URL
`{BACKEND_URL}/api`

## Authentication
All protected endpoints require Clerk JWT token in Authorization header:
```
Authorization: Bearer <clerk_jwt_token>
```

---

## Endpoints

### Health Check
**GET** `/health`

Response:
```json
{
  "status": "healthy",
  "use_google_sheets": false
}
```

---

### Get Vehicles List
**GET** `/vehicles`

Response:
```json
{
  "vehicles": [
    "DL01XX1001",
    "DL02XX1002",
    ...
  ]
}
```

---

### Submit Maintenance Log
**POST** `/maintenance/submit`

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "vehicle_number": "DL01XX1001",
  "battery1_number": "BAT001",
  "battery1_photo_base64": "data:image/jpeg;base64,...",
  "battery2_number": "BAT002",
  "battery2_photo_base64": "data:image/jpeg;base64,...",
  "prime_tyres": [
    {
      "position": "Front Left",
      "number": "TYRE001",
      "photo_base64": "data:image/jpeg;base64,..."
    }
  ],
  "trailer_tyres": [
    {
      "position": "Axle 1 Left Outer",
      "number": "TYRE007",
      "photo_base64": "data:image/jpeg;base64,..."
    }
  ],
  "vehicle_images": [
    {
      "position": "Front",
      "photo_base64": "data:image/jpeg;base64,..."
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Maintenance log saved successfully",
  "record_id": "uuid-string"
}
```

---

### Get Maintenance Logs
**GET** `/maintenance/logs`

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `vehicle` (optional): Filter by vehicle number

**Response:**
```json
{
  "logs": [
    {
      "record_id": "uuid-string",
      "timestamp": "2025-01-15T10:30:00Z",
      "vehicle_number": "DL01XX1001",
      "battery1_number": "BAT001",
      "battery1_photo_link": "https://drive.google.com/...",
      "battery2_number": "BAT002",
      "battery2_photo_link": "https://drive.google.com/...",
      "prime_tyres": [
        {
          "position": "Front Left",
          "number": "TYRE001",
          "photo_link": "https://drive.google.com/..."
        }
      ],
      "trailer_tyres": [...],
      "vehicle_images": [...],
      "created_by": {
        "user_id": "user_xxx",
        "email": "user@example.com",
        "name": "John Doe"
      },
      "synced_to_sheets": true
    }
  ]
}
```

---

### Get Single Maintenance Log
**GET** `/maintenance/logs/{record_id}`

**Headers:**
- `Authorization: Bearer <token>`

**Response:** Same structure as single log from logs array above.

---

## Error Responses

**401 Unauthorized:**
```json
{
  "detail": "Authorization header required"
}
```

**404 Not Found:**
```json
{
  "detail": "Log not found"
}
```

**500 Internal Server Error:**
```json
{
  "detail": "Error message"
}
```
