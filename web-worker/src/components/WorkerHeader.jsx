import { ArrowLeft, Bell, BellRing, Languages, LogOut } from "lucide-react";
import LanguageSelector from "./LanguageSelector";
import StatusBadge from "./StatusBadge";

function getNotificationCopy(permission) {
  if (permission === "granted") {
    return { label: "Alerts On", icon: BellRing };
  }

  if (permission === "denied") {
    return { label: "Alerts Blocked", icon: Bell };
  }

  if (permission === "unsupported") {
    return { label: "No Browser Alerts", icon: Bell };
  }

  return { label: "Enable Alerts", icon: Bell };
}

export default function WorkerHeader({
  user,
  language,
  onLanguageChange,
  notificationPermission,
  onEnableNotifications,
  onBack,
  onLogout,
  status,
}) {
  const notificationCopy = getNotificationCopy(notificationPermission);
  const NotificationIcon = notificationCopy.icon;

  return (
    <header className="worker-header">
      <div className="worker-header-inner">
        <div className="worker-header-main">
          <div className="worker-brand">
            <div className="worker-brand-icon">C</div>
            <div className="worker-brand-copy notranslate" translate="no">
              <div className="worker-brand-name">CivicLink</div>
              <div className="worker-brand-sub">Worker Portal</div>
            </div>
          </div>

          {user && (
            <div className="worker-identity">
              <span className="worker-role-pill">WORKER</span>
              <span className="worker-user-name notranslate" translate="no">
                {user.name || "Worker"}
              </span>
            </div>
          )}
        </div>

        <div className="worker-header-actions">
          {status ? <StatusBadge status={status} /> : null}

          <div className="worker-toolbar-group notranslate" translate="no">
            <div className="worker-toolbar-label">
              <Languages size={16} aria-hidden="true" />
              <span>Language</span>
            </div>
            <LanguageSelector value={language} onChange={onLanguageChange} />
          </div>

          <button
            type="button"
            className="worker-secondary-btn worker-btn-with-icon"
            onClick={onEnableNotifications}
          >
            <NotificationIcon size={18} aria-hidden="true" />
            <span>{notificationCopy.label}</span>
          </button>

          {onBack ? (
            <button
              type="button"
              className="worker-secondary-btn worker-btn-with-icon"
              onClick={onBack}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              <span>Back</span>
            </button>
          ) : null}

          <button
            type="button"
            className="worker-secondary-btn worker-btn-with-icon"
            onClick={onLogout}
          >
            <LogOut size={18} aria-hidden="true" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
