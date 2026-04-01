export default function ComplaintTimeline({ history }) {
  if (!history || history.length === 0) {
    return null;
  }

  const colors = {
    SUBMITTED: "#8a1538",
    ASSIGNED: "#b45309",
    IN_PROGRESS: "#0369a1",
    RESOLVED: "#15803d",
    REJECTED: "#b91c1c",
  };

  return (
    <div className="worker-stack">
      <div className="worker-section-heading">Status History</div>
      <div className="worker-timeline">
        {history.map((entry, index) => (
          <div className="worker-timeline-item" key={entry.id || index}>
            <div
              className="worker-timeline-dot"
              style={{ background: colors[entry.new_status] || "#9ca3af" }}
            />
            <div className="worker-timeline-content">
              <div
                className="worker-timeline-status"
                style={{ color: colors[entry.new_status] || "#4b5563" }}
              >
                {entry.new_status?.replace(/_/g, " ")}
              </div>
              {entry.note && <div className="worker-timeline-note">{entry.note}</div>}
              <div className="worker-timeline-date">
                {entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
