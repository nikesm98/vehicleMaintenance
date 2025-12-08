/********************************************************************
 * CJ DARCL – GOOGLE SHEETS + DRIVE UPLOAD SCRIPT (FULLY FIXED)
 ********************************************************************/

const SHEET_NAME = "Maintenance Logs Trial";
const FOLDER_NAME = "Fleet Maintenance Images";

/************************************************************
 * GET HANDLER (FETCH LOGS)
 ************************************************************/
function doGet(e) {
  try {
    if (e.parameter.action !== "fetch") {
      return json({ success: false, error: "Invalid action" });
    }

    const sheet = getOrCreateSheet(SHEET_NAME);
    const rows = sheet.getDataRange().getValues();
    const logs = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      logs.push({
        record_id: row[0],
        timestamp: row[1],
        vehicle_number: row[2],

        battery1_number: row[3],
        battery1_photo_link: row[4],

        battery2_number: row[5],
        battery2_photo_link: row[6],

        odometer_value: row[7],
        odometer_photo_link: row[8],

        prime_tyres: parseTyreReadable(row[9]),
        prime_tyre_links: parseTyreLinks(row[10]),

        trailer_tyres: parseTyreReadable(row[11]),
        trailer_tyre_links: parseTyreLinks(row[12]),

        vehicle_images: parseVehicleReadable(row[13]),
        vehicle_image_links: parseVehicleLinks(row[14]),

        created_by: {
          user_id: row[15],
          email: row[16],
          name: row[17]
        },

        synced_to_sheets: true
      });
    }

    return json({ logs });

  } catch (err) {
    return json({ success: false, error: err.toString() });
  }
}

/************************************************************
 * POST HANDLER
 ************************************************************/
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");

    if (!body.action)
      return json({ success: false, error: "Missing action" });

    if (body.action === "setup") return setup();
    if (body.action === "submit") return submitMaintenance(body.data);

    return json({ success: false, error: "Unknown action" });

  } catch (err) {
    return json({ success: false, error: err.toString() });
  }
}

/************************************************************
 * SETUP FUNCTION
 ************************************************************/
function setup() {
  const sheet = getOrCreateSheet(SHEET_NAME, [
    "Record ID",                 // 0
    "Timestamp",                 // 1
    "Vehicle Number",            // 2
    "Battery1 Number",           // 3
    "Battery1 Image Link",       // 4
    "Battery2 Number",           // 5
    "Battery2 Image Link",       // 6
    "Odometer Value",            // ⭐ 7 NEW
    "Odometer Image Link",       // ⭐ 8 NEW
    "Prime Tyres (Readable)",    // 9
    "Prime Tyre Links",          // 10
    "Trailer Tyres (Readable)",  // 11
    "Trailer Tyre Links",        // 12
    "Vehicle Images (Readable)", // 13
    "Vehicle Image Links",       // 14
    "CreatedBy_userId",          // 15
    "CreatedBy_email",           // 16
    "CreatedBy_name"             // 17
  ]);

  const folder = getOrCreateFolder(FOLDER_NAME);

  return json({
    success: true,
    sheet_url: sheet.getParent().getUrl(),
    folder_url: folder.getUrl()
  });
}

/************************************************************
 * SUBMIT MAINTENANCE ENTRY
 ************************************************************/
function submitMaintenance(data) {
  try {
    const sheet = getOrCreateSheet(SHEET_NAME);
    const folder = getOrCreateFolder(FOLDER_NAME);

    /******** Battery Images ********/
    const battery1Link = data.battery1_photo_base64
      ? saveImage(folder, `battery1_${data.vehicle_number}`, data.battery1_photo_base64)
      : "";

    const battery2Link = data.battery2_photo_base64
      ? saveImage(folder, `battery2_${data.vehicle_number}`, data.battery2_photo_base64)
      : "";

    /******** Odometer ********/
    const odometerLink = data.odometer_photo_base64
      ? saveImage(folder, `odometer_${data.vehicle_number}`, data.odometer_photo_base64)
      : "";

    /******** Prime Tyres ********/
    const primeReadable = [];
    const primeLinks = [];

    (data.prime_tyres || []).forEach(t => {
      primeReadable.push(`${t.position}: ${t.number}`);
      primeLinks.push(
        t.photo_base64
          ? `${t.position}: ` + saveImage(folder, `prime_${t.position}`, t.photo_base64)
          : `${t.position}: (no photo)`
      );
    });

    /******** Trailer Tyres ********/
    const trailerReadable = [];
    const trailerLinks = [];

    (data.trailer_tyres || []).forEach(t => {
      trailerReadable.push(`${t.position}: ${t.number}`);
      trailerLinks.push(
        t.photo_base64
          ? `${t.position}: ` + saveImage(folder, `trailer_${t.position}`, t.photo_base64)
          : `${t.position}: (no photo)`
      );
    });

    /******** Vehicle Images ********/
    const vehicleReadable = [];
    const vehicleLinks = [];

    (data.vehicle_images || []).forEach(v => {
      vehicleReadable.push(v.position);
      vehicleLinks.push(
        v.photo_base64
          ? `${v.position}: ` + saveImage(folder, `vehicle_${v.position}`, v.photo_base64)
          : `${v.position}: (no photo)`
      );
    });

    /******** Write row ********/
    sheet.appendRow([
      data.record_id,
      data.timestamp,
      data.vehicle_number,

      data.battery1_number,
      battery1Link,

      data.battery2_number,
      battery2Link,

      data.odometer_value,
      odometerLink,

      primeReadable.join("\n"),
      primeLinks.join("\n"),

      trailerReadable.join("\n"),
      trailerLinks.join("\n"),

      vehicleReadable.join("\n"),
      vehicleLinks.join("\n"),

      data.created_by_user_id,
      data.created_by_email,
      data.created_by_name
    ]);

    return json({
      success: true,
      battery1_photo_link: battery1Link,
      battery2_photo_link: battery2Link,
      odometer_photo_link: odometerLink,
      prime_tyre_links: primeLinks,
      trailer_tyre_links: trailerLinks,
      vehicle_image_links: vehicleLinks
    });

  } catch (err) {
    return json({ success: false, error: err.toString() });
  }
}

/************************************************************
 * PARSERS
 ************************************************************/
function parseTyreReadable(str) {
  if (!str || typeof str !== "string") return [];
  return str.split("\n").map(line => {
    const [position, number] = line.split(":").map(s => s.trim());
    return { position: position || "", number: number || "" };
  });
}

function parseTyreLinks(str) {
  if (!str || typeof str !== "string") return [];
  return str.split("\n").map(line => {
    const [position, link] = line.split(": ").map(s => s.trim());
    return {
      position: position || "",
      photo_link: link === "(no photo)" ? "" : (link || "")
    };
  });
}

function parseVehicleReadable(str) {
  if (!str || typeof str !== "string") return [];
  return str.split("\n").map(pos => ({ position: pos.trim(), number: "" }));
}

function parseVehicleLinks(str) {
  if (!str || typeof str !== "string") return [];
  return str.split("\n").map(line => {
    const [position, link] = line.split(": ").map(s => s.trim());
    return {
      position: position || "",
      photo_link: link === "(no photo)" ? "" : (link || "")
    };
  });
}

/************************************************************
 * SAVE IMAGE
 ************************************************************/
function saveImage(folder, name, base64) {
  const cleaned = base64.replace(/^data:image\/\w+;base64,/, "");
  const bytes = Utilities.base64Decode(cleaned);
  const blob = Utilities.newBlob(bytes, "image/jpeg", `${name}.jpg`);
  const file = folder.createFile(blob);
  return file.getUrl();
}

/************************************************************
 * UTIL
 ************************************************************/
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function getOrCreateSheet(name, headers) {
  const files = DriveApp.getFilesByName(name);

  if (files.hasNext()) {
    const ss = SpreadsheetApp.open(files.next());
    return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  }

  const ss = SpreadsheetApp.create(name);
  const sheet = ss.getSheets()[0];

  if (headers) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return sheet;
}
