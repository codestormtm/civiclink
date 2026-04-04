import { CircleCheckBig, ClipboardList, Clock3 } from "lucide-react";
import { useWorkerI18n } from "../i18n";

export default function StatusBadge({ status }) {
  const { formatStatusLabel } = useWorkerI18n();

  const config = {
    ASSIGNED: { tone: "assigned", icon: ClipboardList },
    IN_PROGRESS: { tone: "progress", icon: Clock3 },
    RESOLVED: { tone: "resolved", icon: CircleCheckBig },
  };

  const current = config[status] || {
    tone: "default",
    icon: ClipboardList,
  };

  const Icon = current.icon;

  return (
    <span className={`worker-status-badge ${current.tone}`}>
      <Icon size={14} aria-hidden="true" />
      <span>{formatStatusLabel(status)}</span>
    </span>
  );
}
