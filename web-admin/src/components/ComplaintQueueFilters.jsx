const STATUSES = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED_WRONG_DEPARTMENT"];
const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const selectStyle = {
  padding: "7px 10px", fontSize: 12, border: "1px solid #d1d5db",
  borderRadius: 7, background: "#fff", color: "#374151",
  fontFamily: "inherit", cursor: "pointer", outline: "none",
};

const inputStyle = {
  ...selectStyle, cursor: "text",
};

export default function ComplaintQueueFilters({ filters, onChange, issueTypes = [] }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });

  const hasActiveFilters =
    filters.status || filters.priority || filters.sla_breached ||
    filters.unassigned || filters.search || filters.date_from || filters.date_to;

  const reset = () =>
    onChange({ status: "", priority: "", sla_breached: false, unassigned: false, search: "", date_from: "", date_to: "", issue_type_id: "" });

  return (
    <div style={{
      background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10,
      padding: "12px 14px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {/* Search */}
        <input
          type="text"
          placeholder="Search title or description..."
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          style={{ ...inputStyle, minWidth: 200, flex: 1 }}
        />

        {/* Status */}
        <select value={filters.status} onChange={(e) => set("status", e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>

        {/* Priority */}
        <select value={filters.priority} onChange={(e) => set("priority", e.target.value)} style={selectStyle}>
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Issue Type */}
        {issueTypes.length > 0 && (
          <select value={filters.issue_type_id} onChange={(e) => set("issue_type_id", e.target.value)} style={selectStyle}>
            <option value="">All Types</option>
            {issueTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}

        {/* Date range */}
        <input
          type="date"
          value={filters.date_from}
          onChange={(e) => set("date_from", e.target.value)}
          style={{ ...inputStyle, color: filters.date_from ? "#374151" : "#9ca3af" }}
          title="From date"
        />
        <input
          type="date"
          value={filters.date_to}
          onChange={(e) => set("date_to", e.target.value)}
          style={{ ...inputStyle, color: filters.date_to ? "#374151" : "#9ca3af" }}
          title="To date"
        />

        {/* Toggle filters */}
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#374151", cursor: "pointer", userSelect: "none" }}>
          <input
            type="checkbox"
            checked={filters.sla_breached}
            onChange={(e) => set("sla_breached", e.target.checked)}
          />
          SLA Breached
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#374151", cursor: "pointer", userSelect: "none" }}>
          <input
            type="checkbox"
            checked={filters.unassigned}
            onChange={(e) => set("unassigned", e.target.checked)}
          />
          Unassigned Only
        </label>

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={reset}
            style={{
              padding: "7px 14px", fontSize: 12, fontWeight: 600,
              background: "#fff", color: "#6b7280",
              border: "1px solid #d1d5db", borderRadius: 7,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            ✕ Reset
          </button>
        )}
      </div>
    </div>
  );
}
