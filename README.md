# Internship Tracker v2

A personal dashboard to track internship applications — built with plain
HTML, CSS, and JavaScript. No frameworks, no build step, no server needed.

## File Structure

```
internship-tracker-v2/
├── index.html         ← Open this in your browser to run the app
├── styles.css         ← All styling
├── data.js            ← Data model, localStorage, CRUD, helpers
├── notifications.js   ← Browser notification system
└── app.js             ← Main controller: rendering, events, state
```

## How to Run

1. Put all 5 files in one folder
2. Double-click `index.html` — it opens directly in your browser
3. Or right-click `index.html` in VSCode → "Open with Live Server"

No `npm install`, no terminal, no server needed.

## What's New in v2

### Flexible status flow
All 6 statuses are available at all times — no forced order:
- Applied → Rejected (skipped interview entirely)
- Applied → Interview Scheduled → Interview Done → Accepted
- Applied → Withdrawn (you pulled out)
- Any path you need

### Email used field
Log which email address you used to apply to each company.
Searchable from the filter bar.

### Interview scheduler
When you set status to "Interview Scheduled" or "Interview Done",
a new section appears in the form for:
- Interview date
- Format (video call, on-site, phone, etc.)
- Time window (earliest and latest slot)
- Interview-specific notes

The interview date and time window show as a pill in the table.

### Browser notifications
Click "🔔 Notifications" in the header to configure:
- How often to check (1–30 days)
- Follow-up reminders (Applied with no response after X days)
- Interview reminders (48 hrs before a scheduled interview)
- Weekly summary

Notifications use your browser's built-in system — no email, no accounts.
You approve permission once. Reminders fire while the page is open.

## Status Reference

| Status               | Meaning                                      |
|----------------------|----------------------------------------------|
| Applied              | Submitted, waiting to hear back              |
| Interview Scheduled  | You have an interview booked                 |
| Interview Done       | Interview happened, waiting on decision      |
| Accepted             | You got an offer                             |
| Rejected             | They passed, or you were rejected            |
| Withdrawn            | You withdrew your application                |

## GitHub Workflow

```bash
# First time
git init
git add .
git commit -m "initial commit — internship tracker v2"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/internship-tracker.git
git push -u origin main

# After changes
git add .
git commit -m "what you changed"
git push
```

## Security Note

This app runs entirely in your browser and stores data in localStorage.
There is no API key, no email parsing, and no external services.
It is safe to push to a public GitHub repo.
