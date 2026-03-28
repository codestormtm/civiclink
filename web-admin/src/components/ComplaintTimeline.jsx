export default function ComplaintTimeline({ history }) {
  if (!history || history.length === 0) return null;

  const labelColor = {
    SUBMITTED:   "#1e40af",
    ASSIGNED:    "#92400e",
    IN_PROGRESS: "#065f46",
    RESOLVED:    "#15803d",
    REJECTED:    "#991b1b",
  };

  return (
    <div>
      <h3 style={{ marginBottom: 14 }}>Status History</h3>
      <div style={{ position: "relative", paddingLeft: 20 }}>
        <div style={{
          position: "absolute", left: 7, top: 0, bottom: 0,
          width: 2, background: "#e5e7eb",
        }} />
        {history.map((entry, i) => (
          <div key={entry.id || i} style={{ position: "relative", marginBottom: 18 }}>
            <div style={{
              position: "absolute", left: -20, top: 3,
              width: 10, height: 10, borderRadius: "50%",
              background: labelColor[entry.new_status] || "#9ca3af",
              border: "2px solid #fff",
              boxShadow: "0 0 0 2px #e5e7eb",
            }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: labelColor[entry.new_status] || "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>
              {entry.new_status?.replace("_", " ")}
            </div>
            {entry.note && (
              <div style={{ fontSize: 13, color: "#374151", marginBottom: 2 }}>{entry.note}</div>
            )}
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              {entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
