import { CircleCheckBig, ClipboardList, Clock3 } from "lucide-react";

export default function StatusBadge({ status }) {
  const config = {
    ASSIGNED: { tone: "assigned", icon: ClipboardList, label: "Assigned" },
    IN_PROGRESS: { tone: "progress", icon: Clock3, label: "In Progress" },
    RESOLVED: { tone: "resolved", icon: CircleCheckBig, label: "Resolved" },
  };
  const current = config[status] || {
    tone: "default",
    icon: ClipboardList,
    label: status?.replace(/_/g, " ") || "Unknown",
  };
  const Icon = current.icon;

  return (
    <span className={`worker-status-badge ${current.tone}`}>
      <Icon size={14} aria-hidden="true" />
      <span>{current.label}</span>
    </span>
  );
}
