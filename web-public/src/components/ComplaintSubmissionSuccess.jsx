import { useState } from "react";
import { useCitizenI18n } from "../i18n";
import { ArrowRightIcon, CheckIcon, CopyIcon } from "./PublicIcons";

export default function ComplaintSubmissionSuccess({
  complaint,
  title,
  description,
  warning = "",
  onTrack,
  onReset,
  resetLabel,
}) {
  const { t } = useCitizenI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(complaint.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="card citizen-success-card">
      <div className="citizen-success-icon">
        <CheckIcon size={28} />
      </div>
      <h2 className="citizen-success-title">{title || t("success.title")}</h2>
      <p className="citizen-success-copy">{description || t("success.description")}</p>

      <div className="citizen-success-id-card">
        <div className="citizen-success-id-label">{t("success.trackingId")}</div>
        <div className="citizen-success-id-value">{complaint.id}</div>
        <div className="citizen-success-actions">
          <button
            type="button"
            className="citizen-action-btn is-outline"
            onClick={handleCopy}
          >
            <CopyIcon size={16} />
            {copied ? t("common.copied") : t("success.copyId")}
          </button>
          <button
            type="button"
            className="citizen-action-btn is-maroon"
            onClick={onTrack}
          >
            <ArrowRightIcon size={16} />
            {t("success.track")}
          </button>
        </div>
      </div>

      {complaint.title ? (
        <div className="citizen-success-summary">
          <div className="citizen-success-summary-label">{t("success.submittedAs")}</div>
          <div className="citizen-success-summary-title">{complaint.title}</div>
        </div>
      ) : null}

      {warning ? (
        <div className="alert alert-error" style={{ textAlign: "left", marginBottom: 20 }}>
          {warning}
        </div>
      ) : null}

      <button type="button" onClick={onReset} className="citizen-action-btn is-maroon citizen-action-btn-full">
        <ArrowRightIcon size={16} />
        {resetLabel || t("success.reset")}
      </button>
    </div>
  );
}
