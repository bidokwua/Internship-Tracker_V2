// ── data.js ──────────────────────────────────────────────────────────────────
// All data: statuses, seed records, localStorage, CRUD helpers.
// Loaded FIRST so all other scripts can use these freely.

// ── Statuses ──────────────────────────────────────────────────────────────────
// These are all 6 possible statuses. There is NO forced order —
// an application can jump to any status at any time. The flow is flexible:
//   Path A: Applied → Accepted / Rejected           (no interview)
//   Path B: Applied → Interview Scheduled → Interview Done → Accepted / Rejected
//   Path C: Any stage → Withdrawn                   (you drop out)
const STATUSES = [
  "Applied",
  "Interview Scheduled",
  "Interview Done",
  "Accepted",
  "Rejected",
  "Withdrawn",
];

// Statuses that trigger showing the interview detail fields in the form
const INTERVIEW_STATUSES = ["Interview Scheduled", "Interview Done"];

// How many days with no update before a follow-up warning appears
const FOLLOWUP_THRESHOLD_DAYS = 14;

// ── Seed Data (shown on first load) ──────────────────────────────────────────
const SEED_DATA = [
  {
    id: 1,
    company: "Anduril",
    role: "2027 Software Engineer Intern role",
    dateApplied: "2026-06-29",
    emailUsed: "bidokwua@carleton.edu",
    status: "Applied",
    link: "https://job-boards.greenhouse.io/andurilindustries/jobs/5148079007?gh_jid=5148079007",
    notes: "Rolling review, hiring starts August 2026 for Summer 2027. Applied early per their suggestion. Auto-confirmation received same day.",
    followUpDate: "2026-07-13",
    lastUpdated: "2026-06-29",
    interviewDate: "",
    interviewFormat: "",
    interviewStart: "",
    interviewEnd: "",
    interviewNotes: "",
  },
  {
    id: 2,
    company: "Aquatic Capital Management",
    role: "Software Engineer, Intern (Summer 2027)",
    dateApplied: "2026-06-29",
    emailUsed: "bidokwua@carleton.edu",
    status: "Applied",
    link: "https://job-boards.greenhouse.io/aquaticcapitalmanagement/jobs/8489233002",
    notes: "Quant trading firm, Chicago. Competitive role (asks about IMO/Putnam/USACO). Low expectations given fit, but applied anyway. Auto-confirmation received same day.",
    followUpDate: "2026-07-13",
    lastUpdated: "2026-06-29",
    interviewDate: "",
    interviewFormat: "",
    interviewStart: "",
    interviewEnd: "",
    interviewNotes: "",
  },
  {
    id: 3,
    company: "Consumer Technology Association",
    role: "IT Help Desk Intern",
    dateApplied: "2026-06-27",
    emailUsed: "bidokwua@carleton.edu",
    status: "Applied",
    link: "https://www.indeed.com/viewjob?jk=927af0cb5e0c722b",
    notes: "Arlington, VA. Hybrid, onsite Mon-Wed. Hardware/IT support role, requires travel to CES 2027. Posting has since expired on Indeed, but application was already submitted and confirmed.",
    followUpDate: "2026-07-11",
    lastUpdated: "2026-06-27",
    interviewDate: "",
    interviewFormat: "",
    interviewStart: "",
    interviewEnd: "",
    interviewNotes: "",
  },
];

const STORAGE_KEY       = "ift_apps_v2";
const NOTIF_STORAGE_KEY = "ift_notifs";

// ── Load / Save Apps ──────────────────────────────────────────────────────────

/**
 * Loads apps from localStorage, falling back to seed data.
 * Also migrates old records that are missing new fields.
 */
function loadApps() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(SEED_DATA);
    const apps = JSON.parse(raw);
    // Migrate: add any fields missing from older saved records
    return apps.map(a => ({
      interviewDate: "",
      interviewFormat: "",
      interviewStart: "",
      interviewEnd: "",
      interviewNotes: "",
      emailUsed: "",
      ...a,
    }));
  } catch (e) {
    console.warn("Could not load saved apps, using seed:", e);
    return structuredClone(SEED_DATA);
  }
}

/** Persists the apps array to localStorage. */
function saveApps(apps) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
}

// ── Load / Save Notification Settings ────────────────────────────────────────

/**
 * Default notification settings.
 */
const DEFAULT_NOTIF_SETTINGS = {
  frequencyDays: 7,
  notifFollowUp: true,
  notifInterview: true,
  notifWeekly: false,
  lastChecked: null,
};

/** Loads notification settings from localStorage. */
function loadNotifSettings() {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NOTIF_SETTINGS };
    return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_NOTIF_SETTINGS };
  }
}

/** Saves notification settings to localStorage. */
function saveNotifSettings(settings) {
  localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(settings));
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/** Returns today as YYYY-MM-DD. */
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Returns how many full days ago a date string was.
 * @param {string} dateStr  YYYY-MM-DD
 * @returns {number|null}
 */
function daysAgo(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

/**
 * Returns how many days until a future date.
 * Negative = already past.
 * @param {string} dateStr  YYYY-MM-DD
 * @returns {number|null}
 */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

/** Generates next integer ID. */
function nextId(apps) {
  return apps.length ? Math.max(...apps.map(a => a.id)) + 1 : 1;
}

/**
 * Adds a new application. Mutates apps, persists.
 * @returns {Object} The new record
 */
function addApp(apps, form) {
  const app = {
    id:              nextId(apps),
    company:         form.company.trim(),
    role:            form.role.trim(),
    dateApplied:     form.dateApplied || todayStr(),
    emailUsed:       form.emailUsed.trim(),
    status:          form.status,
    link:            form.link.trim(),
    notes:           form.notes.trim(),
    followUpDate:    form.followUpDate,
    lastUpdated:     todayStr(),
    interviewDate:   form.interviewDate || "",
    interviewFormat: form.interviewFormat || "",
    interviewStart:  form.interviewStart || "",
    interviewEnd:    form.interviewEnd || "",
    interviewNotes:  form.interviewNotes.trim(),
  };
  apps.push(app);
  saveApps(apps);
  return app;
}

/**
 * Updates an existing record in-place. Persists.
 */
function updateApp(apps, id, form) {
  const idx = apps.findIndex(a => a.id === id);
  if (idx === -1) return;
  apps[idx] = {
    ...apps[idx],
    company:         form.company.trim(),
    role:            form.role.trim(),
    dateApplied:     form.dateApplied || apps[idx].dateApplied,
    emailUsed:       form.emailUsed.trim(),
    status:          form.status,
    link:            form.link.trim(),
    notes:           form.notes.trim(),
    followUpDate:    form.followUpDate,
    lastUpdated:     todayStr(),
    interviewDate:   form.interviewDate || "",
    interviewFormat: form.interviewFormat || "",
    interviewStart:  form.interviewStart || "",
    interviewEnd:    form.interviewEnd || "",
    interviewNotes:  form.interviewNotes.trim(),
  };
  saveApps(apps);
}

/**
 * Deletes by ID. Returns new filtered array. Persists.
 */
function deleteApp(apps, id) {
  const next = apps.filter(a => a.id !== id);
  saveApps(next);
  return next;
}

/**
 * Quick inline status update (table dropdown). Persists.
 */
function quickUpdateStatus(apps, id, status) {
  const idx = apps.findIndex(a => a.id === id);
  if (idx === -1) return;
  apps[idx].status      = status;
  apps[idx].lastUpdated = todayStr();
  saveApps(apps);
}

// ── Filtering & Sorting ───────────────────────────────────────────────────────

/**
 * Returns a filtered + sorted copy of apps.
 * Does not mutate the original.
 */
function getVisible(apps, search, filterStatus, sortCol, sortDir) {
  let list = [...apps];

  if (filterStatus !== "All") {
    list = list.filter(a => a.status === filterStatus);
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter(
      a =>
        a.company.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        (a.emailUsed || "").toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => {
    const va = (a[sortCol] || "").toLowerCase();
    const vb = (b[sortCol] || "").toLowerCase();
    if (sortDir === "asc") return va < vb ? -1 : va > vb ? 1 : 0;
    return va > vb ? -1 : va < vb ? 1 : 0;
  });

  return list;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

/**
 * Computes summary numbers for the stat cards.
 */
function getStats(apps) {
  const total     = apps.length;
  const applied   = apps.filter(a => a.status === "Applied").length;
  const interview = apps.filter(a =>
    a.status === "Interview Scheduled" || a.status === "Interview Done"
  ).length;
  const accepted  = apps.filter(a => a.status === "Accepted").length;
  const rejected  = apps.filter(a => a.status === "Rejected").length;
  const responded = apps.filter(a =>
    ["Interview Scheduled", "Interview Done", "Accepted", "Rejected"].includes(a.status)
  ).length;
  const responseRate = total ? Math.round((responded / total) * 100) : 0;
  return { total, applied, interview, accepted, rejected, responseRate };
}

// ── Badge HTML ────────────────────────────────────────────────────────────────

/**
 * Returns the HTML string for a status badge.
 * Maps status string to a CSS class slug.
 */
function badgeHTML(status) {
  const slugMap = {
    "Applied":              "applied",
    "Interview Scheduled":  "interview-scheduled",
    "Interview Done":       "interview-done",
    "Accepted":             "accepted",
    "Rejected":             "rejected",
    "Withdrawn":            "withdrawn",
  };
  const cls = slugMap[status] || "applied";
  return `<span class="badge badge-${cls}"><span class="badge-dot"></span>${escHtml(status)}</span>`;
}

/**
 * Escapes HTML special characters to prevent XSS.
 * Call on ANY user-supplied value before inserting into innerHTML.
 */
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Formats a 24h time string (HH:MM) to 12h display (e.g. "2:00 PM").
 */
function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
