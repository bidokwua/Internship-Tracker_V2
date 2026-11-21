/**
 * emailFlags.gs (v2) - flags application emails by keyword rules. No AI, no tokens.
 *
 * Add as a NEW FILE in the Apps Script project that holds your doPost.
 *
 * Setup order:
 *  1. Edit FLAG_CONFIG if your applications are not on the first tab.
 *  2. Run backfill() once. Approve the Gmail permission prompt. Check the "Email Flags" tab.
 *  3. Run setup() to schedule a scan every 6 hours.
 *
 * It only reads mail and writes to the "Email Flags" tab (plus a digest email to yourself).
 * It never changes your application rows or statuses.
 */

const FLAG_CONFIG = {
  appsSheet: '',                         // tab with your applications; '' = first tab
  flagsSheet: 'Email Flags',
  idCol: 1, companyCol: 2, statusCol: 6, // from your doPost header: ID, Company, ..., Status
  lookbackHours: 26,                     // only used if no scan has run before
  // An email must also contain one of these, which filters out shipping and security mail.
  jobWords: ['application', 'applying', 'applied', 'intern', 'recruit', 'candidate', 'position', 'hiring'],
  // Checked in order. First category with a hit is the label; if several hit, the row says "check".
  rules: [
    { category: 'REJECTION', words: ['unfortunately', 'not moving forward', 'other candidates', 'decided not to proceed', 'will not be moving', 'not be proceeding', 'not the best fit'] },
    { category: 'ASSESSMENT', words: ['assessment', 'codesignal', 'hackerrank', 'codevue', 'hirevue', 'coding challenge', 'complete within', 'must be completed', 'deadline'] },
    { category: 'INTERVIEW', words: ['interview', 'schedule a call', 'your availability', 'phone screen'] },
    { category: 'NEXT_STEPS', words: ['next steps', 'moving forward with your application', 'invite you', 'passed initial screening'] },
  ],
};

const FLAG_HEADERS = ['Received', 'Company', 'Matched IDs (id:status)', 'Category', 'Matched words',
  'Ambiguous?', 'Folder', 'From', 'Subject', 'Link', 'Snippet'];

// ── Entry points ─────────────────────────────────────────────────────────────

function setup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'scanInbox')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('scanInbox').timeBased().everyHours(6).create();
}

// Scheduled scan: everything new since the last scan, then a digest email.
function scanInbox() {
  const last = Number(PropertiesService.getScriptProperties().getProperty('lastScanMs'));
  const since = last || (Date.now() - FLAG_CONFIG.lookbackHours * 3600 * 1000);
  runScan_(since, true);
}

// One-time test and catch-up: scans the last N days (default 14), no digest email.
function backfill(days) {
  runScan_(Date.now() - (days || 14) * 86400000, false);
}

// ── Core ─────────────────────────────────────────────────────────────────────

function runScan_(sinceMs, sendDigest) {
  const startedAt = Date.now();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const companies = getCompanies_(ss);
  const me = Session.getActiveUser().getEmail().toLowerCase();
  // in:anywhere includes the spam folder, which your notes say is worth checking.
  const query = `after:${Math.floor(sinceMs / 1000)} in:anywhere -in:trash -in:sent -in:drafts -category:social`;

  const rows = [];
  for (let start = 0; start < 500; start += 100) {
    const threads = GmailApp.search(query, start, 100);
    threads.forEach(thread => {
      const spam = thread.isInSpam();
      thread.getMessages().forEach(msg => {
        if (msg.getDate().getTime() <= sinceMs) return;
        const from = msg.getFrom();
        if (from.toLowerCase().includes(me)) return;

        const subject = msg.getSubject();
        const body = msg.getPlainBody().slice(0, 1500);
        const text = `${subject} ${body}`.toLowerCase();
        if (!FLAG_CONFIG.jobWords.some(w => text.includes(w))) return;

        // Prefer a company named in the sender or subject; fall back to the body.
        const head = norm_(`${from} ${subject}`);
        let matched = companies.filter(c => c.res.some(re => re.test(head)));
        if (!matched.length) {
          const b = norm_(body);
          matched = companies.filter(c => c.res.some(re => re.test(b)));
        }
        if (!matched.length) return;

        const hits = FLAG_CONFIG.rules
          .map(r => ({ category: r.category, words: r.words.filter(w => text.includes(w)) }))
          .filter(h => h.words.length);
        if (!hits.length) return;

        rows.push([
          msg.getDate(),
          matched.map(c => c.name).join(', '),
          matched.map(c => c.ids.join(' ')).join(' | '),
          hits[0].category,
          hits.map(h => `${h.category}: ${h.words.join('/')}`).join(' | '),
          hits.length > 1 ? 'check' : '',
          spam ? 'spam' : '',
          from,
          subject,
          thread.getPermalink(),
          body.slice(0, 300).replace(/\s+/g, ' '),
        ]);
      });
    });
    if (threads.length < 100) break;
  }

  if (rows.length) {
    writeRows_(ss, rows);
    if (sendDigest) sendDigest_(me, rows);
  }
  PropertiesService.getScriptProperties().setProperty('lastScanMs', String(startedAt));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAppsSheet_(ss) {
  return FLAG_CONFIG.appsSheet ? ss.getSheetByName(FLAG_CONFIG.appsSheet) : ss.getSheets()[0];
}

function norm_(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// "Morgan Stanley / Parametric" -> both names; "GDIT (Praxis Engineering)" -> both; "The X" -> also "X".
function aliases_(name) {
  const parts = name.split(/[\/()]/).map(s => s.trim()).filter(Boolean);
  const out = new Set([name].concat(parts));
  parts.concat([name]).forEach(p => {
    if (/^the\s+/i.test(p)) out.add(p.replace(/^the\s+/i, ''));
  });
  return Array.from(out).filter(s => s.length >= 3);
}

function toRegex_(alias) {
  return new RegExp('\\b' + norm_(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
}

// One entry per company name, collecting every row (id:status) that uses it.
function getCompanies_(ss) {
  const C = FLAG_CONFIG;
  const sheet = getAppsSheet_(ss);
  const n = sheet.getLastRow() - 1;
  if (n < 1) return [];
  const width = Math.max(C.idCol, C.companyCol, C.statusCol);
  const vals = sheet.getRange(2, 1, n, width).getValues();
  const byName = {};
  vals.forEach(r => {
    const name = String(r[C.companyCol - 1]).trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (!byName[key]) byName[key] = { name: name, ids: [], res: aliases_(name).map(toRegex_) };
    byName[key].ids.push(`${r[C.idCol - 1]}:${r[C.statusCol - 1]}`);
  });
  return Object.keys(byName).map(k => byName[k]);
}

function writeRows_(ss, rows) {
  let sheet = ss.getSheetByName(FLAG_CONFIG.flagsSheet);
  if (!sheet) {
    sheet = ss.insertSheet(FLAG_CONFIG.flagsSheet);
    sheet.appendRow(FLAG_HEADERS);
    sheet.getRange('1:1').setFontWeight('bold').setBackground('#e0e0e0');
    sheet.setFrozenRows(1);
    // insertSheet makes the new tab active, so put the applications tab back.
    ss.setActiveSheet(getAppsSheet_(ss));
  }
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function sendDigest_(me, rows) {
  const order = { ASSESSMENT: 0, INTERVIEW: 1, NEXT_STEPS: 2, REJECTION: 3 };
  const sorted = rows.slice().sort((a, b) => (order[a[3]] === undefined ? 9 : order[a[3]]) - (order[b[3]] === undefined ? 9 : order[b[3]]));
  const body = sorted.map(r =>
    `[${r[3]}${r[5] ? ' - check' : ''}${r[6] ? ' - SPAM FOLDER' : ''}] ${r[1]} (${r[2]}): ${r[8]}\n${r[9]}\n${r[10]}`
  ).join('\n\n');
  MailApp.sendEmail(me, `Application emails: ${rows.length} flagged`, body);
}