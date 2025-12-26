# Backend Setup Guide

## Quick Start

### 1. Create `.env` file

Copy `.env.example` to `.env` and fill in your values:

```bash
# Windows
copy .env.example .env

# Linux/Mac
cp .env.example .env
```

### 2. Edit `.env` file

**Required variables:**
- `MONGO_URL` - Your MongoDB connection string
  - Local: `mongodb://localhost:27017`
  - Atlas: `mongodb+srv://username:password@cluster.mongodb.net/`
- `CLERK_SECRET_KEY` - Get from https://dashboard.clerk.com
- `CLERK_DOMAIN` - Your Clerk domain (e.g., `normal-turkey-17.clerk.accounts.dev`)

**Optional variables:**
- `USE_GOOGLE_SHEETS` - Set to `true` if using Google Sheets integration
- `GOOGLE_APPS_SCRIPT_URL` - Your Google Apps Script web app URL

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Start the server

**Windows:**
```bash
start_server.bat
```

**Linux/Mac:**
```bash
chmod +x start_server.sh
./start_server.sh
```

**Or manually:**
```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

## Troubleshooting

### Error: "MONGO_URL environment variable is required"
- Make sure you created a `.env` file in the `backend/` directory
- Check that `MONGO_URL` is set in the `.env` file

### Error: "Connection refused" or "Cannot connect to MongoDB"
- Make sure MongoDB is running
- Check your `MONGO_URL` is correct
- For MongoDB Atlas, make sure your IP is whitelisted

### Error: "CLERK_DOMAIN missing"
- Add `CLERK_DOMAIN=your-domain.clerk.accounts.dev` to your `.env` file
- You can find your domain in Clerk dashboard

### Server won't start
- Check Python version: `python --version` (should be 3.8+)
- Install dependencies: `pip install -r requirements.txt`
- Check if port 8001 is already in use

## Testing the Server

Once running, test with:
```bash
curl http://localhost:8001/api/vehicles
```

Or open in browser: http://localhost:8001/docs (FastAPI auto-generated docs)

