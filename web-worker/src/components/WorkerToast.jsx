import { BellRing, ExternalLink, X } from "lucide-react";
import { useWorkerI18n } from "../i18n";

export default function WorkerToast({ toast, onDismiss, onOpen }) {
  const { t } = useWorkerI18n();

  if (!toast) {
    return null;
  }

  return (
    <div className="worker-toast-stack">
      <div className={`worker-toast worker-toast-${toast.type || "info"}`}>
        <div className="worker-toast-copy">
          <div className="worker-toast-title">
            <BellRing size={18} aria-hidden="true" />
            <span>{toast.title}</span>
          </div>
          <p>{toast.text}</p>
        </div>

        <div className="worker-toast-actions">
          {toast.taskId ? (
            <button
              type="button"
              className="worker-primary-btn worker-btn-with-icon"
              onClick={() => onOpen(toast.taskId)}
            >
              <ExternalLink size={18} aria-hidden="true" />
              <span>{t("toast.openTask")}</span>
            </button>
          ) : null}

          <button
            type="button"
            className="worker-secondary-btn worker-icon-btn"
            onClick={onDismiss}
            aria-label={t("toast.dismiss")}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
