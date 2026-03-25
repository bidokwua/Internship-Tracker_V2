// ── notifications.js ─────────────────────────────────────────────────────────
// Handles all browser notification logic.
// Uses the Web Notifications API — built into every modern browser, no library needed.
//
// HOW IT WORKS:
//   1. On page load, checkAndNotify() runs automatically.
//   2. It reads your saved settings (frequency, which types are on).
//   3. If enough time has passed since the last check, it scans your apps
//      and fires browser notifications for anything that qualifies.
//   4. Settings are saved to localStorage by saveNotifSettings() from data.js.
//
// IMPORTANT: Notifications only fire while the page is open in a browser tab.
// For reminders that fire when the browser is closed you would need a backend
// server (Python with a scheduler) — that's an optional future upgrade.

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Called once by app.js on page load.
 * Checks whether it's time to fire any notifications.
 * @param {Array} apps  Current applications array
 */
function checkAndNotify(apps) {
  // If permission was never granted, nothing to do
  if (Notification.permission !== "granted") return;

  const settings = loadNotifSettings();
  const now      = Date.now();
  const lastCheck = settings.lastChecked ? new Date(settings.lastChecked).getTime() : 0;
  const intervalMs = settings.frequencyDays * 24 * 60 * 60 * 1000;

  // Not enough time has passed since last check — skip
  if (now - lastCheck < intervalMs) return;

  // Run all enabled notification checks
  if (settings.notifFollowUp)  checkFollowUps(apps, settings);
  if (settings.notifInterview) checkUpcomingInterviews(apps);
  if (settings.notifWeekly)    sendWeeklySummary(apps);

  // Update last checked timestamp
  settings.lastChecked = new Date().toISOString();
  saveNotifSettings(settings);
}

/**
 * Requests browser notification permission.
 * Returns a promise that resolves to "granted", "denied", or "default".
 */
async function requestNotifPermission() {
  if (!("Notification" in window)) {
    alert("Your browser does not support notifications.");
    return "denied";
  }
  const result = await Notification.requestPermission();
  return result;
}

/**
 * Fires a single test notification so the user can confirm it works.
 */
function sendTestNotification() {
  if (Notification.permission !== "granted") {
    alert("Please enable notifications first.");
    return;
  }
  fireNotif(
    "Internship Tracker — test",
    "Your notifications are working correctly."
  );
}

/**
 * Returns the current permission state: "granted", "denied", or "default".
 */
function getNotifPermission() {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

// ── Notification Checks ───────────────────────────────────────────────────────

/**
 * Fires a reminder for every "Applied" app with no update
 * past the follow-up threshold.
 */
function checkFollowUps(apps, settings) {
  const overdue = apps.filter(
    a => a.status === "Applied" && daysAgo(a.lastUpdated) >= FOLLOWUP_THRESHOLD_DAYS
  );

  if (!overdue.length) return;

  if (overdue.length === 1) {
    fireNotif(
      "Follow-up needed",
      `You haven't heard back from ${overdue[0].company} in ${daysAgo(overdue[0].lastUpdated)} days.`
    );
  } else {
    const names = overdue.map(a => a.company).join(", ");
    fireNotif(
      `${overdue.length} applications need a follow-up`,
      names
    );
  }
}

/**
 * Fires a reminder for any interview scheduled within the next 48 hours.
 */
function checkUpcomingInterviews(apps) {
  const upcoming = apps.filter(a => {
    if (a.status !== "Interview Scheduled" || !a.interviewDate) return false;
    const d = daysUntil(a.interviewDate);
    return d !== null && d >= 0 && d <= 2;
  });

  upcoming.forEach(a => {
    const d     = daysUntil(a.interviewDate);
    const when  = d === 0 ? "today" : d === 1 ? "tomorrow" : "in 2 days";
    const time  = a.interviewStart ? ` at ${formatTime(a.interviewStart)}` : "";
    fireNotif(
      `Interview ${when} — ${a.company}`,
      `${a.role}${time}${a.interviewFormat ? " · " + a.interviewFormat : ""}`
    );
  });
}

/**
 * Sends a weekly summary of all active applications.
 */
function sendWeeklySummary(apps) {
  const stats    = getStats(apps);
  const active   = apps.filter(a => !["Accepted","Rejected","Withdrawn"].includes(a.status));
  const body     = `${stats.total} total · ${stats.applied} pending · ${stats.interview} in interview stage · ${active.length} active`;

  fireNotif("Weekly application summary", body);
}

// ── Core Notification Helper ──────────────────────────────────────────────────

/**
 * Creates and shows a browser notification.
 * Does nothing if permission is not granted.
 * @param {string} title
 * @param {string} body
 */
function fireNotif(title, body) {
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23F59E0B'/><text x='16' y='22' text-anchor='middle' font-size='18'>⚡</text></svg>",
      tag:  title, // prevents duplicate notifications with same title
    });
  } catch (e) {
    console.warn("Notification failed:", e);
  }
}

// ── Notification Settings UI ──────────────────────────────────────────────────
// These functions are called by app.js to wire up the settings modal.

/**
 * Populates the notification settings modal with current saved values.
 */
function populateNotifModal() {
  const s = loadNotifSettings();

  document.getElementById("freqDisplay").textContent   = s.frequencyDays;
  document.getElementById("notifFollowUp").checked     = s.notifFollowUp;
  document.getElementById("notifInterview").checked    = s.notifInterview;
  document.getElementById("notifWeekly").checked       = s.notifWeekly;

  // Show the permission request block if permission hasn't been granted
  const permBlock = document.getElementById("permissionBlock");
  if (getNotifPermission() !== "granted") {
    permBlock.classList.remove("hidden");
  } else {
    permBlock.classList.add("hidden");
  }
}

/**
 * Reads the notification settings modal and saves to localStorage.
 */
function saveNotifModalSettings() {
  const current = loadNotifSettings();
  current.frequencyDays  = Number(document.getElementById("freqDisplay").textContent) || 7;
  current.notifFollowUp  = document.getElementById("notifFollowUp").checked;
  current.notifInterview = document.getElementById("notifInterview").checked;
  current.notifWeekly    = document.getElementById("notifWeekly").checked;
  saveNotifSettings(current);
}

/**
 * Increments or decrements the frequency display.
 * Min 1, max 30.
 * @param {number} delta  +1 or -1
 */
function adjustFrequency(delta) {
  const el  = document.getElementById("freqDisplay");
  const val = Math.min(30, Math.max(1, Number(el.textContent) + delta));
  el.textContent = val;
}
