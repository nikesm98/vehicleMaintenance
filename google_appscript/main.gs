/**
 * CJ Darcl Fleet Maintenance - Google Apps Script
 * 
 * This script handles:
 * 1. Receiving maintenance data from the backend
 * 2. Uploading images to Google Drive
 * 3. Appending data to Google Sheets
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Apps Script project at script.google.com
 * 2. Copy this entire code into the script editor
 * 3. Create a Google Sheet and note its ID from the URL
 * 4. Create a Google Drive folder for images and note its ID
 * 5. Update SHEET_ID and DRIVE_FOLDER_ID below
 * 6. Deploy as Web App:
 *    - Click Deploy > New Deployment
 *    - Select type: Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 7. Copy the Web App URL and add it to your backend .env as GOOGLE_APPS_SCRIPT_URL
 */

// Configuration - UPDATE THESE VALUES
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';  // Get from sheet URL
const DRIVE_FOLDER_ID = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE';  // Get from folder URL
const SHEET_NAME = 'MaintenanceLogs';  // Sheet tab name

/**
 * Handle POST requests from the backend
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'submit') {
      return handleSubmission(data.data);
    }
    
    return createResponse(false, 'Unknown action');
  } catch (error) {
    return createResponse(false, error.toString());
  }
}

/**
 * Handle GET requests (for testing)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'CJ Darcl Fleet Maintenance Apps Script is running'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle maintenance submission
 */
function handleSubmission(data) {
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const vehicleFolder = getOrCreateFolder(folder, data.vehicle_number);
    const dateFolder = getOrCreateFolder(vehicleFolder, formatDate(new Date()));
    
    // Upload images and get links
    let battery1PhotoLink = null;
    let battery2PhotoLink = null;
    const primeTyreLinks = [];
    const trailerTyreLinks = [];
    const vehicleImageLinks = [];
    
    // Battery photos
    if (data.battery1_photo_base64) {
      battery1PhotoLink = uploadImage(dateFolder, 'battery1', data.battery1_photo_base64);
    }
    if (data.battery2_photo_base64) {
      battery2PhotoLink = uploadImage(dateFolder, 'battery2', data.battery2_photo_base64);
    }
    
    // Prime tyre photos
    if (data.prime_tyres) {
      data.prime_tyres.forEach((tyre, index) => {
        if (tyre.photo_base64) {
          const link = uploadImage(dateFolder, `prime_tyre_${index + 1}_${tyre.position.replace(/\s+/g, '_')}`, tyre.photo_base64);
          primeTyreLinks.push(link);
        } else {
          primeTyreLinks.push(null);
        }
      });
    }
    
    // Trailer tyre photos
    if (data.trailer_tyres) {
      data.trailer_tyres.forEach((tyre, index) => {
        if (tyre.photo_base64) {
          const link = uploadImage(dateFolder, `trailer_tyre_${index + 1}_${tyre.position.replace(/\s+/g, '_')}`, tyre.photo_base64);
          trailerTyreLinks.push(link);
        } else {
          trailerTyreLinks.push(null);
        }
      });
    }
    
    // Vehicle images
    if (data.vehicle_images) {
      data.vehicle_images.forEach((img, index) => {
        if (img.photo_base64) {
          const link = uploadImage(dateFolder, `vehicle_${img.position}`, img.photo_base64);
          vehicleImageLinks.push(link);
        } else {
          vehicleImageLinks.push(null);
        }
      });
    }
    
    // Prepare sheet data
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME) || 
                  SpreadsheetApp.openById(SHEET_ID).insertSheet(SHEET_NAME);
    
    // Check if header exists, if not create it
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Record ID',
        'Timestamp',
        'Vehicle Number',
        'Battery1 Number',
        'Battery1 Image Link',
        'Battery2 Number',
        'Battery2 Image Link',
        'Tyres JSON',
        'Tyre Image Links JSON',
        'Vehicle Image Links JSON',
        'CreatedBy_userId',
        'CreatedBy_email',
        'CreatedBy_name'
      ]);
    }
    
    // Prepare tyres data
    const tyresJson = JSON.stringify({
      prime: data.prime_tyres ? data.prime_tyres.map(t => ({ position: t.position, number: t.number })) : [],
      trailer: data.trailer_tyres ? data.trailer_tyres.map(t => ({ position: t.position, number: t.number })) : []
    });
    
    const tyreLinksJson = JSON.stringify({
      prime: primeTyreLinks,
      trailer: trailerTyreLinks
    });
    
    const vehicleLinksJson = JSON.stringify(vehicleImageLinks);
    
    // Append row
    sheet.appendRow([
      data.record_id,
      data.timestamp,
      data.vehicle_number,
      data.battery1_number || '',
      battery1PhotoLink || '',
      data.battery2_number || '',
      battery2PhotoLink || '',
      tyresJson,
      tyreLinksJson,
      vehicleLinksJson,
      data.created_by_user_id || '',
      data.created_by_email || '',
      data.created_by_name || ''
    ]);
    
    return createResponse(true, 'Data saved successfully', {
      battery1_photo_link: battery1PhotoLink,
      battery2_photo_link: battery2PhotoLink,
      prime_tyre_links: primeTyreLinks,
      trailer_tyre_links: trailerTyreLinks,
      vehicle_image_links: vehicleImageLinks
    });
    
  } catch (error) {
    return createResponse(false, error.toString());
  }
}

/**
 * Upload base64 image to Drive
 */
function uploadImage(folder, name, base64Data) {
  try {
    // Remove data URL prefix if present
    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'image/jpeg', `${name}_${Date.now()}.jpg`);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
}

/**
 * Get or create a folder
 */
function getOrCreateFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parent.createFolder(name);
}

/**
 * Format date for folder name
 */
function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Create JSON response
 */
function createResponse(success, message, data = {}) {
  return ContentService.createTextOutput(JSON.stringify({
    success,
    message,
    ...data
  })).setMimeType(ContentService.MimeType.JSON);
}
