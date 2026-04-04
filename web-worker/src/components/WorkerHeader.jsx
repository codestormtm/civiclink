import { ArrowLeft, Bell, BellRing, LogOut, Menu, Settings2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useWorkerI18n } from "../i18n";
import StatusBadge from "./StatusBadge";

function getNotificationCopy(permission, t) {
  if (permission === "granted") {
    return { label: t("header.notifications.on"), icon: BellRing };
  }

  if (permission === "denied") {
    return { label: t("header.notifications.blocked"), icon: Bell };
  }

  if (permission === "unsupported") {
    return { label: t("header.notifications.unsupported"), icon: Bell };
  }

  return { label: t("header.notifications.enable"), icon: Bell };
}

export default function WorkerHeader({
  user,
  notificationPermission,
  onEnableNotifications,
  onBack,
  onOpenSettings,
  onLogout,
  status,
}) {
  const { t } = useWorkerI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const notificationCopy = getNotificationCopy(notificationPermission, t);
  const NotificationIcon = notificationCopy.icon;

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <header className="worker-header">
      <div className="worker-header-inner">
        <div className="worker-header-main">
          <div className="worker-brand">
            <div className="worker-brand-icon">C</div>
            <div className="worker-brand-copy notranslate" translate="no">
              <div className="worker-brand-name">{t("portal.brand")}</div>
              <div className="worker-brand-sub">{t("portal.worker")}</div>
            </div>
          </div>

          {user ? (
            <div className="worker-identity">
              <span className="worker-role-pill">{t("portal.workerRole")}</span>
              <span className="worker-user-name notranslate" translate="no">
                {user.name || t("portal.workerRole")}
              </span>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="worker-menu-toggle"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label={menuOpen ? t("header.closeMenu") : t("header.openMenu")}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>

        <div className={`worker-header-actions ${menuOpen ? "is-open" : ""}`}>
          {status ? <StatusBadge status={status} /> : null}

          <button
            type="button"
            className="worker-secondary-btn worker-btn-with-icon"
            onClick={onEnableNotifications}
          >
            <NotificationIcon size={18} aria-hidden="true" />
            <span>{notificationCopy.label}</span>
          </button>

          {onOpenSettings ? (
            <button
              type="button"
              className="worker-secondary-btn worker-btn-with-icon"
              onClick={() => {
                closeMenu();
                onOpenSettings();
              }}
            >
              <Settings2 size={18} aria-hidden="true" />
              <span>{t("header.settings")}</span>
            </button>
          ) : null}

          {onBack ? (
            <button
              type="button"
              className="worker-secondary-btn worker-btn-with-icon"
              onClick={() => {
                closeMenu();
                onBack();
              }}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              <span>{t("header.back")}</span>
            </button>
          ) : null}

          <button
            type="button"
            className="worker-secondary-btn worker-btn-with-icon"
            onClick={() => {
              closeMenu();
              onLogout();
            }}
          >
            <LogOut size={18} aria-hidden="true" />
            <span>{t("header.logout")}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
