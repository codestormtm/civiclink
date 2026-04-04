import { useEffect, useState } from "react";
import api from "../api/api";
import { useCitizenI18n } from "../i18n";
import {
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  SearchIcon,
  TrackIcon,
} from "../components/PublicIcons";
import {
  getLastTrackedComplaintId,
  getRecentComplaintRefs,
  rememberTrackedComplaint,
  removeRecentComplaintRef,
  setLastTrackedComplaintId,
} from "../utils/portalState";

const STATUS_ORDER = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"];

function isImageAttachment(attachment) {
  if (attachment?.is_image) {
    return true;
  }

  const fileType = String(attachment?.file_type || "").trim().toLowerCase();
  if (fileType.startsWith("image/")) {
    return true;
  }

  const objectKey = String(attachment?.file_object_key || "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(objectKey);
}

function getAttachmentFileName(attachment, index) {
  const objectKey = attachment.file_object_key || "";
  const fileName = objectKey.split("/").pop();
  return fileName || `attachment-${index + 1}`;
}

async function downloadProtectedAttachment(attachment, fallbackName) {
  const response = await api.get(attachment.file_url, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

function StatusSteps({ status, meta, t }) {
  const currentIndex = STATUS_ORDER.indexOf(status);
  const isRejected = status === "REJECTED_WRONG_DEPARTMENT" || status === "CLOSED";

  return (
    <div className="track-status-steps">
      <div className="track-status-steps-row">
        {STATUS_ORDER.map((step, index) => {
          const done = !isRejected && index <= currentIndex;
          const active = !isRejected && index === currentIndex;
          return (
            <div key={step} className="track-status-step">
              <div className="track-status-step-main">
                <div className={`track-status-step-dot ${done ? "is-done" : ""} ${active ? "is-active" : ""}`}>
                  {done ? (index === currentIndex && !isRejected ? index + 1 : "\u2713") : index + 1}
                </div>
                <div className={`track-status-step-label ${done ? "is-done" : ""}`}>
                  {meta[step].label}
                </div>
              </div>
              {index < STATUS_ORDER.length - 1 ? (
                <div className={`track-status-step-line ${!isRejected && index < currentIndex ? "is-done" : ""}`} />
              ) : null}
            </div>
          );
        })}
      </div>

      {isRejected ? (
        <div className="track-status-rejected">{status === "CLOSED" ? t("status.closed") : t("status.rejected")}</div>
      ) : null}
    </div>
  );
}

function Timeline({ events, formatDateTime, t }) {
  if (!events || events.length === 0) {
    return null;
  }

  return (
    <div className="track-timeline">
      <div className="track-timeline-title">{t("track.timeline")}</div>
      <div className="track-timeline-list">
        {events.map((event, index) => (
          <div key={index} className="track-timeline-item">
            <div className="track-timeline-marker" />
            <div className="track-timeline-event">{event.event}</div>
            <div className="track-timeline-desc">{event.description}</div>
            <div className="track-timeline-date">{formatDateTime(event.timestamp)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrackComplaint() {
  const { t, formatDateTime, formatStatusLabel } = useCitizenI18n();
  const [complaintId, setComplaintId] = useState(() => getLastTrackedComplaintId());
  const [recentRefs, setRecentRefs] = useState(() => getRecentComplaintRefs());
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState({});
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState("");

  useEffect(() => {
    let active = true;
    const objectUrls = [];
    const imageAttachments = (result?.attachments || []).filter(isImageAttachment);

    if (!imageAttachments.length) {
      setAttachmentPreviewUrls({});
      setSelectedImageId(null);
      return () => {};
    }

    void (async () => {
      const nextPreviewUrls = {};

      await Promise.all(
        imageAttachments.map(async (attachment) => {
          try {
            const response = await api.get(attachment.file_url, { responseType: "blob" });
            const objectUrl = URL.createObjectURL(response.data);
            objectUrls.push(objectUrl);
            nextPreviewUrls[attachment.id] = objectUrl;
          } catch {
            nextPreviewUrls[attachment.id] = "";
          }
        }),
      );

      if (active) {
        setAttachmentPreviewUrls(nextPreviewUrls);
      }
    })();

    return () => {
      active = false;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [result]);

  const statusMeta = {
    SUBMITTED: { label: t("status.submitted"), color: "#1e40af", bg: "#eff6ff" },
    ASSIGNED: { label: t("status.assigned"), color: "#5b21b6", bg: "#f5f3ff" },
    IN_PROGRESS: { label: t("status.inProgress"), color: "#164e63", bg: "#ecfeff" },
    RESOLVED: { label: t("status.resolved"), color: "#065f46", bg: "#ecfdf5" },
    CLOSED: { label: t("status.closed"), color: "#374151", bg: "#f3f4f6" },
    REJECTED_WRONG_DEPARTMENT: { label: t("status.rejected"), color: "#991b1b", bg: "#fef2f2" },
  };

  const statusDescriptions = {
    SUBMITTED: t("status.desc.submitted"),
    ASSIGNED: t("status.desc.assigned"),
    IN_PROGRESS: t("status.desc.inProgress"),
    RESOLVED: t("status.desc.resolved"),
    CLOSED: t("status.desc.closed"),
    REJECTED_WRONG_DEPARTMENT: t("status.desc.rejected"),
  };

  const attachmentRoleLabels = {
    BEFORE: t("attachment.before"),
    AFTER: t("attachment.after"),
    GENERAL: t("attachment.general"),
  };

  const syncRecentRefs = () => {
    setRecentRefs(getRecentComplaintRefs());
  };

  const pruneStoredComplaintId = (id) => {
    removeRecentComplaintRef(id);
    if (getLastTrackedComplaintId() === id) {
      setLastTrackedComplaintId("");
    }
    syncRecentRefs();
  };

  const trackComplaint = async (id = complaintId, options = {}) => {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) {
      return;
    }

    try {
      setError("");
      setResult(null);
      setLoading(true);
      setComplaintId(normalizedId);

      const res = await api.get(`/citizen-complaints/track/${normalizedId}`);
      setResult(res.data.data);
      rememberTrackedComplaint(normalizedId);
      syncRecentRefs();
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.error || err?.response?.data?.message || t("track.notFound");

      if (status === 404 && options.fromStored) {
        pruneStoredComplaintId(normalizedId);
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const lastTrackedId = getLastTrackedComplaintId();
    if (!lastTrackedId) {
      return;
    }

    void trackComplaint(lastTrackedId, { fromStored: true });
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      void trackComplaint();
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(result.complaint.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAttachment = async (attachment, fallbackName) => {
    try {
      setDownloadingAttachmentId(attachment.id);
      await downloadProtectedAttachment(attachment, fallbackName);
    } catch (err) {
      setError(err?.response?.data?.error || t("track.downloadFailed"));
    } finally {
      setDownloadingAttachmentId("");
    }
  };

  const complaint = result?.complaint;
  const meta = complaint ? (statusMeta[complaint.status] || statusMeta.SUBMITTED) : null;
  const imageAttachments = (result?.attachments || []).filter(isImageAttachment);
  const fileAttachments = (result?.attachments || []).filter((attachment) => !isImageAttachment(attachment));
  const selectedImage = imageAttachments.find((attachment) => attachment.id === selectedImageId) || null;
  const selectedImageUrl = selectedImage ? attachmentPreviewUrls[selectedImage.id] : "";

  return (
    <div className="container">
      <div className="page-heading">
        <h2>{t("track.heading")}</h2>
        <p>{t("track.subtitle")}</p>
      </div>

      <div className="card">
        <div className="track-search-row">
          <input
            type="text"
            placeholder={t("track.placeholder")}
            value={complaintId}
            onChange={(event) => setComplaintId(event.target.value)}
            onKeyDown={handleKeyDown}
            className="track-search-input"
          />
          <button
            onClick={() => trackComplaint()}
            disabled={loading}
            className="citizen-action-btn is-primary track-search-btn"
          >
            <SearchIcon size={16} />
            {loading ? t("common.searching") : t("track.button")}
          </button>
        </div>

        {recentRefs.length > 0 ? (
          <div className="track-recent-refs">
            <div className="track-recent-refs-title">{t("track.recent")}</div>
            <div className="track-recent-refs-list">
              {recentRefs.map((ref) => (
                <button
                  key={ref}
                  type="button"
                  onClick={() => trackComplaint(ref, { fromStored: true })}
                  className={`track-ref-chip ${ref === complaintId ? "is-active" : ""}`}
                >
                  {ref}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <div className="alert alert-error" style={{ marginTop: 14 }}>{error}</div> : null}
      </div>

      {result && complaint ? (
        <div className="card">
          <div className="track-result-header">
            <div className="track-result-title-wrap">
              <div className="track-result-kicker">
                <TrackIcon size={15} />
                {t("track.status")}
              </div>
              <h3 className="track-result-title">{complaint.title}</h3>
            </div>
            <span className="track-result-badge" style={{ background: meta.bg, color: meta.color }}>
              {meta.label}
            </span>
          </div>

          <div className="track-result-summary" style={{ borderLeftColor: meta.color }}>
            {statusDescriptions[complaint.status]}
          </div>

          <StatusSteps status={complaint.status} meta={statusMeta} t={t} />

          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
            {[
              ["track.summaryId", (
                <span className="track-id-row">
                  <span className="track-id-value">{complaint.id}</span>
                  <button onClick={copyId} className={`track-copy-btn ${copied ? "is-copied" : ""}`}>
                    <CopyIcon size={14} />
                    {copied ? t("common.copied") : t("common.copy")}
                  </button>
                </span>
              )],
              ["track.summaryDepartment", complaint.department_name],
              ["track.summaryType", complaint.complaint_type],
              ["track.summaryDescription", complaint.description],
              ["track.summarySubmitted", formatDateTime(complaint.submitted_at)],
              ...(complaint.resolved_at ? [["track.summaryResolved", formatDateTime(complaint.resolved_at)]] : []),
              ...(complaint.rejection_reason ? [["track.summaryRejection", complaint.rejection_reason]] : []),
            ].map(([labelKey, value]) => (
              <div key={labelKey} className="result-row">
                <strong>{t(labelKey)}</strong>
                <span>{value}</span>
              </div>
            ))}
          </div>

          {result.timeline && result.timeline.length > 0 ? (
            <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 8 }}>
              <Timeline events={result.timeline} formatDateTime={formatDateTime} t={t} />
            </div>
          ) : null}

          <div className="attachments-section">
            <div className="attachments-title">{t("track.imageGallery")}</div>
            {imageAttachments.length === 0 ? (
              <p className="empty-text">{t("track.imageEmpty")}</p>
            ) : (
              <div className="attachment-gallery-grid">
                {imageAttachments.map((attachment, index) => {
                  const previewUrl = attachmentPreviewUrls[attachment.id];
                  return (
                    <button
                      type="button"
                      key={attachment.id}
                      className="attachment-gallery-tile"
                      onClick={() => previewUrl && setSelectedImageId(attachment.id)}
                    >
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={`Complaint attachment ${index + 1}`}
                          className="attachment-gallery-image"
                        />
                      ) : (
                        <div className="attachment-gallery-placeholder">{t("common.loading")}</div>
                      )}
                      <div className="attachment-gallery-meta">
                        <span className={`attachment-role-badge attachment-role-badge-${attachment.attachment_role.toLowerCase()}`}>
                          {attachmentRoleLabels[attachment.attachment_role] || t("attachment.general")}
                        </span>
                        <span>{formatDateTime(attachment.created_at)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="attachments-section">
            <div className="attachments-title">{t("track.otherAttachments")}</div>
            {fileAttachments.length === 0 ? (
              <p className="empty-text">{t("track.fileEmpty")}</p>
            ) : (
              <div className="attachment-file-list">
                {fileAttachments.map((attachment, index) => {
                  const fallbackName = getAttachmentFileName(attachment, index);
                  return (
                    <div key={attachment.id} className="attachment-file-row">
                      <div className="attachment-file-copy">
                        <span className={`attachment-role-badge attachment-role-badge-${attachment.attachment_role.toLowerCase()}`}>
                          {attachmentRoleLabels[attachment.attachment_role] || t("attachment.general")}
                        </span>
                        <strong>{fallbackName}</strong>
                        <span>{attachment.file_type || t("attachment.unknownType")}</span>
                      </div>
                      <button
                        type="button"
                        className="attachment-download-btn"
                        disabled={downloadingAttachmentId === attachment.id}
                        onClick={() => downloadAttachment(attachment, fallbackName)}
                      >
                        <DownloadIcon size={16} />
                        {downloadingAttachmentId === attachment.id ? t("common.downloading") : t("common.download")}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {selectedImage && selectedImageUrl ? (
        <div className="attachment-lightbox-backdrop" onClick={() => setSelectedImageId(null)}>
          <div className="attachment-lightbox-card" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="attachment-lightbox-close"
              onClick={() => setSelectedImageId(null)}
            >
              <CloseIcon size={16} />
              {t("common.close")}
            </button>
            <img
              src={selectedImageUrl}
              alt="Selected complaint attachment"
              className="attachment-lightbox-image"
            />
            <div className="attachment-gallery-meta">
              <span className={`attachment-role-badge attachment-role-badge-${selectedImage.attachment_role.toLowerCase()}`}>
                {attachmentRoleLabels[selectedImage.attachment_role] || t("attachment.general")}
              </span>
              <span>{formatDateTime(selectedImage.created_at)}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
