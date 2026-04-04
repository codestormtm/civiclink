import { History } from "lucide-react";
import { useWorkerI18n } from "../i18n";

export default function ComplaintTimeline({ history }) {
  const { t, formatDateTime, formatStatusLabel } = useWorkerI18n();

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
      <div className="worker-section-title">
        <History size={18} aria-hidden="true" />
        <span>{t("timeline.title")}</span>
      </div>
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
                {formatStatusLabel(entry.new_status)}
              </div>
              {entry.note ? <div className="worker-timeline-note">{entry.note}</div> : null}
              <div className="worker-timeline-date worker-timeline-meta">
                <span>{formatDateTime(entry.created_at)}</span>
                {entry.changed_by_name ? <span>{t("common.by", { name: entry.changed_by_name })}</span> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
