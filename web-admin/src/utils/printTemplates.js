function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrintDate(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function basePrintDocument({ title, bodyHtml }) {
  return `
    <style>
      :root {
        color-scheme: light;
        --ink: #111827;
        --muted: #6b7280;
        --line: #d1d5db;
        --accent: #1f4ed8;
        --bg-soft: #f8fafc;
      }

      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: "Inter", Arial, sans-serif;
        color: var(--ink);
        background: #ffffff;
        padding: 32px;
      }

      h1, h2, h3, p { margin: 0; }
      .print-shell {
        max-width: 920px;
        margin: 0 auto;
      }
      .print-header {
        border-bottom: 3px solid var(--accent);
        padding-bottom: 14px;
        margin-bottom: 24px;
      }
      .print-letterhead {
        font-size: 12px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        margin-bottom: 10px;
      }
      .print-title {
        font-size: 28px;
        font-weight: 800;
        margin-bottom: 6px;
      }
      .print-subtitle {
        font-size: 13px;
        color: var(--muted);
      }
      .print-meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px 16px;
        margin: 18px 0 26px;
        padding: 14px 16px;
        background: var(--bg-soft);
        border: 1px solid var(--line);
        border-radius: 10px;
      }
      .print-meta-item {
        font-size: 13px;
      }
      .print-meta-label {
        display: block;
        font-size: 11px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 4px;
      }
      .print-section {
        margin-bottom: 24px;
        break-inside: avoid;
      }
      .print-section-title {
        font-size: 14px;
        font-weight: 800;
        margin-bottom: 10px;
      }
      .print-card {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 16px;
        background: #fff;
      }
      .print-paragraph {
        font-size: 14px;
        line-height: 1.75;
        margin-bottom: 12px;
        white-space: pre-wrap;
      }
      .signature-block {
        margin-top: 48px;
        padding-top: 18px;
        display: flex;
        justify-content: flex-end;
      }
      .signature-box {
        width: 280px;
        text-align: center;
      }
      .signature-line {
        border-top: 1px solid var(--ink);
        margin-bottom: 8px;
      }
      .signature-label {
        font-size: 12px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid var(--line);
        padding: 10px 12px;
        text-align: left;
        font-size: 13px;
      }
      th {
        background: var(--bg-soft);
        font-size: 11px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .align-center { text-align: center; }
      .report-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
      }
      .report-stat {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 14px;
        background: #fff;
      }
      .report-stat-label {
        font-size: 11px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 6px;
      }
      .report-stat-value {
        font-size: 22px;
        font-weight: 800;
      }
      .empty-note {
        font-size: 13px;
        color: var(--muted);
        font-style: italic;
      }
      @media print {
        body { padding: 0; }
        .print-shell { max-width: none; }
      }
    </style>
    <div class="print-shell" aria-label="${escapeHtml(title)}">
      ${bodyHtml}
    </div>
  `;
}

function parseTerminationLetter(letterBody) {
  const lines = String(letterBody || "")
    .split("\n")
    .map((line) => line.trimEnd());

  const details = {
    title: "Formal Termination Letter",
    date: "",
    department: "",
    employee: "",
    paragraphs: [],
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      details.paragraphs.push("");
      continue;
    }

    if (trimmed.toUpperCase() === "FORMAL TERMINATION LETTER") {
      details.title = "Formal Termination Letter";
      continue;
    }

    if (trimmed.startsWith("Date:")) {
      details.date = trimmed.replace(/^Date:\s*/, "");
      continue;
    }

    if (trimmed.startsWith("Department:")) {
      details.department = trimmed.replace(/^Department:\s*/, "");
      continue;
    }

    if (trimmed.startsWith("Employee:")) {
      details.employee = trimmed.replace(/^Employee:\s*/, "");
      continue;
    }

    details.paragraphs.push(trimmed);
  }

  return details;
}

export function buildTerminationLetterPrintHtml({
  letterBody,
  departmentName,
  terminatedAt,
  workerName,
}) {
  const parsed = parseTerminationLetter(letterBody);
  const displayDepartment = parsed.department || departmentName || "Department";
  const displayWorkerName = parsed.employee || workerName || "-";
  const displayDate = parsed.date || formatPrintDate(terminatedAt);

  const bodyParagraphs = parsed.paragraphs
    .reduce((acc, line) => {
      if (!line) {
        acc.push(`<div class="print-paragraph"></div>`);
        return acc;
      }

      acc.push(`<div class="print-paragraph">${escapeHtml(line)}</div>`);
      return acc;
    }, [])
    .join("");

  return basePrintDocument({
    title: parsed.title,
    bodyHtml: `
      <div class="print-header">
        <div class="print-letterhead">${escapeHtml(displayDepartment)}</div>
        <div class="print-title">${escapeHtml(parsed.title)}</div>
        <div class="print-subtitle">Official employment termination notice</div>
      </div>

      <div class="print-meta">
        <div class="print-meta-item">
          <span class="print-meta-label">Date</span>
          ${escapeHtml(displayDate)}
        </div>
        <div class="print-meta-item">
          <span class="print-meta-label">Employee</span>
          ${escapeHtml(displayWorkerName)}
        </div>
      </div>

      <div class="print-card">
        ${bodyParagraphs}
      </div>

      <div class="signature-block">
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Department Manager</div>
        </div>
      </div>
    `,
  });
}

function buildTable(headers, rows, alignments = {}) {
  const headerHtml = headers
    .map((header) => `<th class="${alignments[header.key] || ""}">${escapeHtml(header.label)}</th>`)
    .join("");

  const rowHtml = rows
    .map(
      (row) => `
        <tr>
          ${headers
            .map((header) => `<td class="${alignments[header.key] || ""}">${escapeHtml(row[header.key])}</td>`)
            .join("")}
        </tr>
      `
    )
    .join("");

  return `
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${rowHtml}</tbody>
    </table>
  `;
}

export function buildReportsPrintHtml({
  departmentName,
  selectedSections,
  workload,
  performance,
}) {
  const hasWorkload = selectedSections.workload && workload.length > 0;
  const hasMonthly = selectedSections.monthly && performance.monthly.length > 0;
  const hasPriority = selectedSections.priority && performance.by_priority.length > 0;

  const sections = [];

  if (hasWorkload) {
    sections.push(`
      <section class="print-section">
        <div class="print-section-title">Worker Workload</div>
        ${buildTable(
          [
            { key: "name", label: "Worker" },
            { key: "active_assignments", label: "Active" },
            { key: "assigned_count", label: "Assigned" },
            { key: "in_progress_count", label: "In Progress" },
            { key: "completed_last_30_days", label: "Completed (30d)" },
            { key: "total_ever", label: "Total Ever" },
          ],
          workload,
          {
            active_assignments: "align-center",
            assigned_count: "align-center",
            in_progress_count: "align-center",
            completed_last_30_days: "align-center",
            total_ever: "align-center",
          }
        )}
      </section>
    `);
  }

  if (hasMonthly) {
    const monthlyRows = performance.monthly.map((row) => {
      const rate =
        row.total_received > 0
          ? `${Math.round((row.total_resolved / row.total_received) * 100)}%`
          : "0%";

      return {
        month: row.month,
        total_received: row.total_received,
        total_resolved: row.total_resolved,
        resolution_rate: rate,
        sla_breached: row.sla_breached,
        avg_resolution_hours:
          row.avg_resolution_hours != null ? `${row.avg_resolution_hours}h` : "-",
      };
    });

    sections.push(`
      <section class="print-section">
        <div class="print-section-title">Monthly Performance</div>
        ${buildTable(
          [
            { key: "month", label: "Month" },
            { key: "total_received", label: "Received" },
            { key: "total_resolved", label: "Resolved" },
            { key: "resolution_rate", label: "Resolution Rate" },
            { key: "sla_breached", label: "SLA Breached" },
            { key: "avg_resolution_hours", label: "Avg. Resolution" },
          ],
          monthlyRows,
          {
            total_received: "align-center",
            total_resolved: "align-center",
            resolution_rate: "align-center",
            sla_breached: "align-center",
            avg_resolution_hours: "align-center",
          }
        )}
      </section>
    `);
  }

  if (hasPriority) {
    sections.push(`
      <section class="print-section">
        <div class="print-section-title">Priority Breakdown</div>
        <div class="report-grid">
          ${performance.by_priority
            .map((row) => {
              const resolutionRate =
                row.total > 0 ? `${Math.round((row.resolved / row.total) * 100)}%` : "0%";

              return `
                <div class="report-stat">
                  <div class="report-stat-label">${escapeHtml(row.priority_level)}</div>
                  <div class="report-stat-value">${escapeHtml(row.total)}</div>
                  <div class="print-paragraph">Resolved: ${escapeHtml(row.resolved)}</div>
                  <div class="print-paragraph">SLA Breached: ${escapeHtml(row.sla_breached)}</div>
                  <div class="print-paragraph">Resolution Rate: ${escapeHtml(resolutionRate)}</div>
                </div>
              `;
            })
            .join("")}
        </div>
      </section>
    `);
  }

  if (sections.length === 0) {
    sections.push(`<div class="empty-note">No printable report data is currently available.</div>`);
  }

  return basePrintDocument({
    title: "Department Reports",
    bodyHtml: `
      <div class="print-header">
        <div class="print-letterhead">${escapeHtml(departmentName || "Department")}</div>
        <div class="print-title">Department Reports</div>
        <div class="print-subtitle">Generated from the department admin portal</div>
      </div>

      <div class="print-meta">
        <div class="print-meta-item">
          <span class="print-meta-label">Department</span>
          ${escapeHtml(departmentName || "-")}
        </div>
        <div class="print-meta-item">
          <span class="print-meta-label">Generated</span>
          ${escapeHtml(formatDateTime())}
        </div>
      </div>

      ${sections.join("")}
    `,
  });
}
