# Internship Tracker v2

A personal dashboard for tracking internship applications. Plain HTML, CSS, and JavaScript. No frameworks, no build step, no server.

I built it to keep a 70+ application search organized: what I applied to, with which email, what happened next, and when to check back.

## Features

- Sortable, searchable table with status filters
- Seven statuses with no forced order (an application can jump to any status)
- Add/edit form: company, role, date applied, email used, status, follow-up date, deadline, link, company contact, and notes
- Interview section that appears for "Interview Scheduled" and "Interview Done" (date, format, time window, notes)
- Summary cards: total, pending, interviews, accepted, rejected, ghosted, response rate
- Banners for follow-ups needed, upcoming interviews, and applications ready to follow up
- CSV export
- Browser notifications for follow-ups, interviews, and a weekly summary (only while the page is open)
- Optional sync of each saved record to a Google Sheet

## Status reference

| Status              | Meaning                                       |
|---------------------|-----------------------------------------------|
| Applied             | Submitted, waiting to hear back               |
| Interview Scheduled | An interview or assessment is booked          |
| Interview Done      | It happened, waiting on a decision            |
| Accepted            | Offer received                                |
| Rejected            | The company passed                            |
| Ghosted             | No response after the follow-up window        |
| Withdrawn           | I pulled out                                  |

## Files

```
Internship-Tracker/
├── index.html                  Open this in a browser to run the app
├── styles.css                  All styling
├── data.js                     Statuses, sample data, localStorage, CRUD helpers
├── notifications.js            Browser notification logic
├── googleSync.js               Optional Google Sheet sync
├── googleSyncConfig.example.js Template for the sync URL (copy it, see below)
├── app.js                      Main controller: rendering, events, state
└── .gitignore                  Keeps private files out of the repo
```

Private files that are intentionally not in this repo: `localData.js` (my real applications), `googleSyncConfig.js` (my sync URL), and any backup or cleanup scripts for that data.

## How to run

1. Download or clone the repo.
2. Open `index.html` in a browser, or use "Open with Live Server" in VS Code.

On first load the app shows three sample applications. The browser console may show 404 errors for `localData.js` and `googleSyncConfig.js`. That is expected and harmless, because those files are private and optional.

Your data is stored in your browser's localStorage, so it stays on your machine.

## Using your own data from a file (optional)

Create a `localData.js` next to `index.html`. It should define an array of application records with the same fields as `SEED_DATA` in `data.js` and write them to localStorage under the key `ift_apps_v2`. The file is gitignored so it never gets pushed.

One behavior to know about: `localData.js` re-seeds the browser whenever its contents change, so edits made in the browser can be overwritten after you change the file.

## Google Sheet sync (optional)

When you save, change a status, or delete a record, the app can send that record to a Google Apps Script web app that you set up yourself.

1. Create your own Apps Script web app that accepts a JSON POST and writes a row.
2. Copy `googleSyncConfig.example.js` to `googleSyncConfig.js`.
3. Put your web app URL in `googleSyncConfig.js`.

`googleSyncConfig.js` is gitignored. Treat the URL like a password: anyone who has it can send rows to your sheet. If it is missing or still the placeholder, sync is skipped and the app works normally.

## Notifications

Click "Notifications" in the header to set how often to check (1 to 30 days) and which reminders you want. Reminders use the browser's built-in Notifications API, need one-time permission, and only fire while the page is open in a tab.

## Privacy notes

- No accounts, no tracking, no backend of mine.
- Data lives in localStorage unless you turn on Sheet sync, in which case full records (including notes and contact details) are sent to your own Apps Script URL.
- Do not commit `localData.js`, backups of it, or `googleSyncConfig.js`.