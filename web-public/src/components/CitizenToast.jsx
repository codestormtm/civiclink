import { CloseIcon, TrackIcon } from "./PublicIcons";
import { useCitizenI18n } from "../i18n";

export default function CitizenToast({ toast, onDismiss, onOpen }) {
  const { t } = useCitizenI18n();

  if (!toast) {
    return null;
  }

  return (
    <div className="citizen-toast-stack">
      <div className={`citizen-toast citizen-toast-${toast.type || "info"}`}>
        <div className="citizen-toast-copy">
          <div className="citizen-toast-title">
            <TrackIcon size={18} />
            <span>{toast.title}</span>
          </div>
          <p>{toast.text}</p>
        </div>

        <div className="citizen-toast-actions">
          {toast.complaintId ? (
            <button
              type="button"
              className="citizen-toast-open"
              onClick={() => onOpen(toast.complaintId)}
            >
              <span>{t("toast.openComplaint")}</span>
            </button>
          ) : null}

          <button
            type="button"
            className="citizen-toast-dismiss"
            onClick={onDismiss}
            aria-label={t("toast.dismiss")}
          >
            <CloseIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
