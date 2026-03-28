export default function StatusBadge({ status }) {
  const styles = {
    SUBMITTED:   { background: "#dbeafe", color: "#1e40af" },
    ASSIGNED:    { background: "#fef3c7", color: "#92400e" },
    IN_PROGRESS: { background: "#d1fae5", color: "#065f46" },
    RESOLVED:    { background: "#dcfce7", color: "#15803d" },
    REJECTED:    { background: "#fee2e2", color: "#991b1b" },
  };
  const s = styles[status] || { background: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{
      ...s,
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      whiteSpace: "nowrap",
    }}>
      {status?.replace("_", " ") || "UNKNOWN"}
    </span>
  );
}
