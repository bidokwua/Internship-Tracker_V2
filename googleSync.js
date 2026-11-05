// ── googleSync.js ────────────────────────────────────────────────────────────


async function syncAppToGoogleSheet(appData) {
  if (typeof GOOGLE_SHEET_WEB_APP_URL === "undefined" ||
      !GOOGLE_SHEET_WEB_APP_URL ||
      GOOGLE_SHEET_WEB_APP_URL.includes("YOUR_WEB_APP_URL_HERE")) {
    console.warn("Google Sheet sync not configured.");
    return;
  }

  try {
    // Send data to Google Apps Script Webhook
    await fetch(GOOGLE_SHEET_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors", // Bypasses browser CORS restrictions for Google Apps Script
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(appData)
    });
    console.log(`Synced ID #${appData.id} (${appData.company}) to Google Sheet.`);
  } catch (err) {
    console.error("Failed to sync application to Google Sheet:", err);
  }
}