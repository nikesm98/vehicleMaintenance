# CJ Darcl Fleet Maintenance System

A comprehensive fleet maintenance management system for tracking vehicle inspections, battery status, and tyre conditions.

## Features

- **Digital Inspection Forms**: Complete vehicle maintenance forms with photo documentation
- **Battery Tracking**: Log battery numbers and conditions with photos
- **Tyre Management**: Track 6 prime tyres and 12 trailer tyres per vehicle
- **Photo Documentation**: Capture front, left, right, and rear vehicle images
- **Real-time Dashboard**: View all maintenance logs with search and filter
- **Cloud Storage**: Automatic backup to Google Sheets and Google Drive
- **User Authentication**: Secure access with Clerk (Google OAuth)

## Tech Stack

- **Frontend**: React, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Authentication**: Clerk
- **Cloud Storage**: Google Sheets + Google Drive (optional)

## Setup Instructions

### 1. Environment Variables

#### Frontend (.env)
```
REACT_APP_BACKEND_URL=your_backend_url
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

#### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=fleet_maintenance_db
CLERK_SECRET_KEY=sk_test_xxx
CLERK_PUBLISHABLE_KEY=pk_test_xxx
USE_GOOGLE_SHEETS=false
GOOGLE_APPS_SCRIPT_URL=your_apps_script_url
```

### 2. Google Sheets Integration (Optional)

1. Create a Google Apps Script project
2. Copy the code from `/google_appscript/main.gs`
3. Create a Google Sheet and Drive folder
4. Update the script with your Sheet ID and Folder ID
5. Deploy as Web App
6. Set `USE_GOOGLE_SHEETS=true` and add the Web App URL to backend .env

### 3. Running the Application

#### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

#### Frontend
```bash
cd frontend
yarn install
yarn start
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/vehicles | Get list of vehicles |
| POST | /api/maintenance/submit | Submit maintenance log |
| GET | /api/maintenance/logs | Get all maintenance logs |
| GET | /api/maintenance/logs?vehicle=XX | Filter logs by vehicle |

## Color Palette

- Primary Blue: #007BC1
- Navy: #204788
- Grey: #747375
- Yellow (Prime Tyres): #F5A11B
- Red (Trailer Tyres): #E73036

## License

© 2025 CJ Darcl. All rights reserved.
