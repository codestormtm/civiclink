export default function StatusBadge({ status }) {
  const toneMap = {
    ASSIGNED: "assigned",
    IN_PROGRESS: "progress",
    RESOLVED: "resolved",
  };

  return (
    <span className={`worker-status-badge ${toneMap[status] || "default"}`}>
      {status?.replace(/_/g, " ") || "UNKNOWN"}
    </span>
  );
}
