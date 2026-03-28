export default function SlaWarningCard({ count, onFilter }) {
  if (!count || count === 0) return null;

  return (
    <div
      onClick={onFilter}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        background: "#fef2f2", border: "1px solid #fca5a5",
        borderRadius: 10, padding: "12px 16px", marginBottom: 16,
        cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 26 }}>⚠️</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#dc2626" }}>
          {count} SLA {count === 1 ? "Breach" : "Breaches"} Detected
        </div>
        <div style={{ fontSize: 12, color: "#ef4444", marginTop: 2 }}>
          {count} complaint{count > 1 ? "s have" : " has"} exceeded their SLA deadline. Click to view.
        </div>
      </div>
      <div style={{
        padding: "5px 12px", background: "#dc2626", color: "#fff",
        borderRadius: 6, fontSize: 12, fontWeight: 600, flexShrink: 0,
      }}>
        View →
      </div>
    </div>
  );
}
