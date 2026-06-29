// ── app.js ────────────────────────────────────────────────────────────────────
// Main application controller.
// Handles all rendering, event wiring, sort/filter state, and modal logic.
// Depends on data.js and notifications.js being loaded first.

// ── State ─────────────────────────────────────────────────────────────────────
let apps         = loadApps();
let search       = "";
let filterStatus = "All";
let sortCol      = "dateApplied";
let sortDir      = "desc";

// Expose to notifications.js so it can read the latest apps
window._apps = apps;

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  wireEvents();
  renderAll();
  // Run notification checks on every page load
  checkAndNotify(apps);
});

// ── Master Render ─────────────────────────────────────────────────────────────
function renderAll() {
  window._apps = apps;
  renderStats();
  renderFollowUpBanner();
  renderInterviewBanner();
  renderTable();
  const n = apps.length;
  document.getElementById("appCount").textContent = `${n} app${n !== 1 ? "s" : ""}`;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
  const s = getStats(apps);
  document.getElementById("statTotal").textContent     = s.total;
  document.getElementById("statApplied").textContent   = s.applied;
  document.getElementById("statInterview").textContent = s.interview;
  document.getElementById("statAccepted").textContent  = s.accepted;
  document.getElementById("statRejected").textContent  = s.rejected;
  document.getElementById("statRate").textContent      = `${s.responseRate}%`;
}

// ── Follow-up Banner ──────────────────────────────────────────────────────────
function renderFollowUpBanner() {
  const banner = document.getElementById("followupBanner");
  const list   = document.getElementById("followupList");

  const due = apps.filter(
    a => a.status === "Applied" && daysAgo(a.lastUpdated) >= FOLLOWUP_THRESHOLD_DAYS
  );

  if (!due.length) { banner.classList.add("hidden"); return; }

  banner.classList.remove("hidden");
  list.innerHTML = due.map(a =>
    `<span class="followup-chip">${escHtml(a.company)}</span>`
  ).join("");
}

// ── Upcoming Interview Banner ─────────────────────────────────────────────────
function renderInterviewBanner() {
  const banner = document.getElementById("interviewBanner");
  const list   = document.getElementById("interviewBannerList");

  // Interviews within the next 3 days
  const soon = apps.filter(a => {
    if (a.status !== "Interview Scheduled" || !a.interviewDate) return false;
    const d = daysUntil(a.interviewDate);
    return d !== null && d >= 0 && d <= 3;
  });

  if (!soon.length) { banner.classList.add("hidden"); return; }

  banner.classList.remove("hidden");
  list.innerHTML = soon.map(a => {
    const d    = daysUntil(a.interviewDate);
    const when = d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
    return `<span class="interview-chip">${escHtml(a.company)} — ${when}</span>`;
  }).join("");
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable() {
  const tbody   = document.getElementById("tableBody");
  const emptyEl = document.getElementById("emptyState");
  const tableEl = document.getElementById("appTable");

  const visible = getVisible(apps, search, filterStatus, sortCol, sortDir);

  // Update sort arrows
  document.querySelectorAll("th[data-col]").forEach(th => {
    const icon = th.querySelector(".sort-icon");
    if (th.dataset.col === sortCol) {
      th.classList.add("sorted");
      icon.textContent = sortDir === "asc" ? "↑" : "↓";
    } else {
      th.classList.remove("sorted");
      icon.textContent = "";
    }
  });

  if (!visible.length) {
    tableEl.classList.add("hidden");
    emptyEl.classList.remove("hidden");
    return;
  }

  tableEl.classList.remove("hidden");
  emptyEl.classList.add("hidden");

  tbody.innerHTML = visible.map((app, i) => buildRow(app, i)).join("");

  // Row click → edit modal
  tbody.querySelectorAll("tr").forEach(tr => {
    tr.addEventListener("click", e => {
      if (e.target.closest(".status-cell") || e.target.closest(".link-cell")) return;
      openEditModal(Number(tr.dataset.id));
    });
  });

  // Inline status dropdown
  tbody.querySelectorAll(".quick-select").forEach(sel => {
    sel.addEventListener("change", e => {
      e.stopPropagation();
      const id = Number(sel.closest("tr").dataset.id);
      quickUpdateStatus(apps, id, sel.value);
      renderAll();
    });
  });
}

// ── Build Table Row ───────────────────────────────────────────────────────────
function buildRow(app, index) {
  const needsFollowUp = app.status === "Applied" && daysAgo(app.lastUpdated) >= FOLLOWUP_THRESHOLD_DAYS;
  const followUpPast  = app.followUpDate && app.followUpDate < todayStr();
  const interviewSoon = app.status === "Interview Scheduled" && app.interviewDate &&
                        daysUntil(app.interviewDate) >= 0 && daysUntil(app.interviewDate) <= 3;

  // Status dropdown options — all 6, no forced path
  const statusOptions = STATUSES
    .map(s => `<option value="${escHtml(s)}" ${s === app.status ? "selected" : ""}>${escHtml(s)}</option>`)
    .join("");

  // Interview cell
  let interviewCell = `<td class="td-mono">—</td>`;
  if (INTERVIEW_STATUSES.includes(app.status) && app.interviewDate) {
    const timeStr = app.interviewStart
      ? `${formatTime(app.interviewStart)}${app.interviewEnd ? " – " + formatTime(app.interviewEnd) : ""}`
      : "";
    interviewCell = `
      <td>
        <span class="interview-pill">
          ${escHtml(app.interviewDate)}${timeStr ? " · " + escHtml(timeStr) : ""}
        </span>
      </td>`;
  }

  // Follow-up cell
  const followUpCell = app.followUpDate
    ? `<td class="td-followup ${followUpPast ? "overdue" : ""}">${followUpPast ? "⏰ " : ""}${escHtml(app.followUpDate)}</td>`
    : `<td style="color:var(--muted2);font-family:var(--font-mono);font-size:11px">—</td>`;

  // Link cell
  const linkCell = app.link
    ? `<td class="link-cell"><a class="ext-link" href="${escHtml(app.link)}" target="_blank" rel="noopener">↗</a></td>`
    : `<td></td>`;

  return `
    <tr
      data-id="${app.id}"
      class="${needsFollowUp ? "needs-followup" : ""}"
      style="animation: fadeUp .3s ease ${index * 0.035}s both"
    >
      <td class="td-company">
        ${needsFollowUp  ? "⚠️ " : ""}
        ${interviewSoon  ? "📅 " : ""}
        ${escHtml(app.company)}
      </td>
      <td class="td-mono">${escHtml(app.role)}</td>
      <td class="td-date">${escHtml(app.dateApplied || "—")}</td>
      <td class="td-mono">${escHtml(app.emailUsed || "—")}</td>
      <td class="status-cell">
        ${badgeHTML(app.status)}
        <select class="quick-select" title="Change status">${statusOptions}</select>
      </td>
      ${interviewCell}
      ${followUpCell}
      ${linkCell}
    </tr>
  `;
}

// ── Add Modal ─────────────────────────────────────────────────────────────────
function openAddModal() {
  document.getElementById("formModalTitle").textContent = "New Application";
  document.getElementById("formId").value = "";
  clearForm();
  document.getElementById("deleteBtn").classList.add("hidden");
  document.getElementById("notesPreview").classList.add("hidden");
  document.getElementById("formModal").classList.remove("hidden");
  // Ensure interview section starts hidden
  syncInterviewSection();
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function openEditModal(id) {
  const app = apps.find(a => a.id === id);
  if (!app) return;

  document.getElementById("formModalTitle").textContent = `Edit — ${escHtml(app.company)}`;
  document.getElementById("formId").value               = app.id;

  document.getElementById("formCompany").value       = app.company;
  document.getElementById("formRole").value          = app.role;
  document.getElementById("formDate").value          = app.dateApplied;
  document.getElementById("formEmailUsed").value     = app.emailUsed || "";
  document.getElementById("formStatus").value        = app.status;
  document.getElementById("formFollowUp").value      = app.followUpDate;
  document.getElementById("formLink").value          = app.link;
  document.getElementById("formNotes").value         = app.notes;

  // Interview fields
  document.getElementById("formInterviewDate").value   = app.interviewDate   || "";
  document.getElementById("formInterviewFormat").value = app.interviewFormat || "";
  document.getElementById("formInterviewStart").value  = app.interviewStart  || "";
  document.getElementById("formInterviewEnd").value    = app.interviewEnd    || "";
  document.getElementById("formInterviewNotes").value  = app.interviewNotes  || "";

  // Notes preview
  const preview = document.getElementById("notesPreview");
  if (app.notes) {
    preview.innerHTML = `
      <div class="notes-preview-label">Notes</div>
      <p class="notes-preview-text">${escHtml(app.notes)}</p>
    `;
    preview.classList.remove("hidden");
  } else {
    preview.classList.add("hidden");
  }

  document.getElementById("deleteBtn").classList.remove("hidden");
  document.getElementById("formModal").classList.remove("hidden");
  syncInterviewSection();
}

function closeFormModal() {
  document.getElementById("formModal").classList.add("hidden");
}

// ── Interview Section Show/Hide ───────────────────────────────────────────────
// This is the key function for the flexible status flow.
// The interview detail fields only appear when the status is
// "Interview Scheduled" or "Interview Done". For every other status —
// including going straight from Applied to Rejected — they stay hidden.
function syncInterviewSection() {
  const status  = document.getElementById("formStatus").value;
  const section = document.getElementById("interviewSection");
  const show    = INTERVIEW_STATUSES.includes(status);
  section.classList.toggle("hidden", !show);
}

// ── Form Helpers ──────────────────────────────────────────────────────────────
function clearForm() {
  document.getElementById("formCompany").value       = "";
  document.getElementById("formRole").value          = "";
  document.getElementById("formDate").value          = "";
  document.getElementById("formEmailUsed").value     = "";
  document.getElementById("formStatus").value        = "Applied";
  document.getElementById("formFollowUp").value      = "";
  document.getElementById("formLink").value          = "";
  document.getElementById("formNotes").value         = "";
  document.getElementById("formInterviewDate").value   = "";
  document.getElementById("formInterviewFormat").value = "";
  document.getElementById("formInterviewStart").value  = "";
  document.getElementById("formInterviewEnd").value    = "";
  document.getElementById("formInterviewNotes").value  = "";
}

function getFormValues() {
  return {
    company:         document.getElementById("formCompany").value,
    role:            document.getElementById("formRole").value,
    dateApplied:     document.getElementById("formDate").value,
    emailUsed:       document.getElementById("formEmailUsed").value,
    status:          document.getElementById("formStatus").value,
    followUpDate:    document.getElementById("formFollowUp").value,
    link:            document.getElementById("formLink").value,
    notes:           document.getElementById("formNotes").value,
    interviewDate:   document.getElementById("formInterviewDate").value,
    interviewFormat: document.getElementById("formInterviewFormat").value,
    interviewStart:  document.getElementById("formInterviewStart").value,
    interviewEnd:    document.getElementById("formInterviewEnd").value,
    interviewNotes:  document.getElementById("formInterviewNotes").value,
  };
}

// ── Event Wiring ──────────────────────────────────────────────────────────────
function wireEvents() {

  // Header buttons
  document.getElementById("openAddBtn").addEventListener("click", openAddModal);
  document.getElementById("openNotifsBtn").addEventListener("click", openNotifsModal);
  document.getElementById("emptyAddLink").addEventListener("click", openAddModal);

  // Form modal
  document.getElementById("closeFormModal").addEventListener("click", closeFormModal);
  document.getElementById("formModal").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeFormModal();
  });

  // Show/hide interview section when status changes
  document.getElementById("formStatus").addEventListener("change", syncInterviewSection);

  // Save form
  document.getElementById("appForm").addEventListener("submit", () => {
    const form = getFormValues();
    if (!form.company.trim() || !form.role.trim()) {
      alert("Company and Role are required.");
      return;
    }
    const id = Number(document.getElementById("formId").value);
    if (id) {
      updateApp(apps, id, form);
    } else {
      addApp(apps, form);
    }
    closeFormModal();
    renderAll();
  });

  // Delete button
  document.getElementById("deleteBtn").addEventListener("click", () => {
    const id = Number(document.getElementById("formId").value);
    if (!id) return;
    if (!confirm(`Delete this application? This cannot be undone.`)) return;
    apps = deleteApp(apps, id);
    window._apps = apps;
    closeFormModal();
    renderAll();
  });

  // Search
  document.getElementById("searchInput").addEventListener("input", e => {
    search = e.target.value;
    renderTable();
  });

  // Filter buttons
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterStatus = btn.dataset.status;
      renderTable();
    });
  });

  // Column sort
  document.querySelectorAll("th[data-col]").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortCol = col;
        sortDir = "asc";
      }
      renderTable();
    });
  });

  // ── Notification modal events ──
  document.getElementById("closeNotifsModal").addEventListener("click", closeNotifsModal);
  document.getElementById("notifsModal").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeNotifsModal();
  });

  document.getElementById("freqMinus").addEventListener("click", () => adjustFrequency(-1));
  document.getElementById("freqPlus").addEventListener("click",  () => adjustFrequency(+1));

  document.getElementById("requestPermBtn").addEventListener("click", async () => {
    const result = await requestNotifPermission();
    if (result === "granted") {
      document.getElementById("permissionBlock").classList.add("hidden");
    } else {
      alert("Notifications were blocked. You can enable them in your browser settings.");
    }
  });

  document.getElementById("testNotifBtn").addEventListener("click", sendTestNotification);

  document.getElementById("saveNotifsBtn").addEventListener("click", () => {
    saveNotifModalSettings();
    closeNotifsModal();
  });
}

// ── Notifications Modal ───────────────────────────────────────────────────────
function openNotifsModal() {
  populateNotifModal();
  document.getElementById("notifsModal").classList.remove("hidden");
}
function closeNotifsModal() {
  document.getElementById("notifsModal").classList.add("hidden");
}
