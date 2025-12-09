import base64
import io
import os
import mimetypes
import logging
from typing import Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

logger = logging.getLogger(__name__)
from dotenv import load_dotenv
load_dotenv()


# -----------------------------------------------------------
# ENVIRONMENT VARIABLES
# -----------------------------------------------------------
SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
]

SERVICE_ACCOUNT_FILE = os.environ.get("GSHEET_SERVICE_ACCOUNT_JSON")
SPREADSHEET_ID = os.environ.get("GSHEET_SPREADSHEET_ID")
DRIVE_FOLDER_ID = os.environ.get("GSHEET_DRIVE_FOLDER_ID")

if not SERVICE_ACCOUNT_FILE:
    raise RuntimeError("GSHEET_SERVICE_ACCOUNT_JSON path not set.")

creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)

# -----------------------------------------------------------
# GOOGLE API CLIENTS
# -----------------------------------------------------------
_drive_service = build("drive", "v3", credentials=creds)
_sheets_service = build("sheets", "v4", credentials=creds).spreadsheets()


# -----------------------------------------------------------
# HELPERS
# -----------------------------------------------------------
def _guess_mime(filename: str) -> str:
    mt, _ = mimetypes.guess_type(filename)
    return mt or "image/jpeg"


def upload_base64_image(base64_str: Optional[str], filename: str) -> str:
    """
    Upload a base64 image to Google Drive and return a shareable link.
    Must be called inside asyncio.to_thread().
    """
    if not base64_str:
        return ""

    # Remove base64 header
    if "," in base64_str:
        base64_str = base64_str.split(",", 1)[1]

    try:
        file_bytes = base64.b64decode(base64_str)
    except Exception as e:
        logger.exception("Failed to decode base64 image: %s", e)
        return ""

    fh = io.BytesIO(file_bytes)
    media = MediaIoBaseUpload(fh, mimetype=_guess_mime(filename), resumable=False)

    metadata = {"name": filename}
    if DRIVE_FOLDER_ID:
        metadata["parents"] = [DRIVE_FOLDER_ID]

    try:
        created = _drive_service.files().create(
            body=metadata,
            media_body=media,
            fields="id,webViewLink,webContentLink",
        ).execute()

        # Make file publicly readable
        try:
            _drive_service.permissions().create(
                fileId=created["id"],
                body={"role": "reader", "type": "anyone"},
                fields="id",
            ).execute()
        except Exception:
            pass

        return (
            created.get("webViewLink")
            or created.get("webContentLink")
            or f"https://drive.google.com/file/d/{created['id']}/view"
        )

    except Exception as e:
        logger.exception("Drive upload failed: %s", e)
        return ""


def append_row_to_sheet(values: list):
    """
    Add a row to the sheet.
    """
    if not SPREADSHEET_ID:
        raise RuntimeError("GSHEET_SPREADSHEET_ID not configured")

    body = {"values": [values]}

    _sheets_service.values().append(
        spreadsheetId=SPREADSHEET_ID,
        range="A1",
        valueInputOption="RAW",
        insertDataOption="INSERT_ROWS",
        body=body,
    ).execute()


# -----------------------------------------------------------
# READ ALL LOGS FROM GOOGLE SHEET
# -----------------------------------------------------------
def read_sheet_logs() -> list:
    """
    Reads all logs from the Google Sheet and returns a list of dict rows.
    This is what your FastAPI uses for /maintenance/logs.
    """
    if not SPREADSHEET_ID:
        raise RuntimeError("GSHEET_SPREADSHEET_ID not configured")

    result = _sheets_service.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="A1:Z9999",   # covers all columns you use
    ).execute()

    rows = result.get("values", [])
    if not rows or len(rows) < 2:
        return []

    headers = rows[0]
    records = rows[1:]

    formatted = []
    for row in records:
        entry = {}
        for i, header in enumerate(headers):
            entry[header] = row[i] if i < len(row) else ""
        formatted.append(entry)

    return formatted
