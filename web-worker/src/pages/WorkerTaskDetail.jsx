import {
  CheckCircle2,
  Download,
  FileImage,
  Files,
  MapPinned,
  Navigation,
  Play,
  Upload,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import api from "../api/api";
import { useWorkerI18n } from "../i18n";
import ComplaintTimeline from "../components/ComplaintTimeline";
import OfflineSyncStatus from "../components/OfflineSyncStatus";
import StatusBadge from "../components/StatusBadge";
import WorkerHeader from "../components/WorkerHeader";
import { queueEvidenceUpload, queueStatusUpdate } from "../utils/offlineQueue";

function buildMapsUrl(latitude, longitude) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

function getAttachmentRoleLabel(role, t) {
  if (role === "BEFORE") return t("task.attachmentRole.beforeLabel");
  if (role === "AFTER") return t("task.attachmentRole.afterLabel");
  return t("task.attachmentRole.generalLabel");
}

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

export default function WorkerTaskDetail({
  taskId,
  user,
  goBack,
  onLogout,
  onOpenSettings,
  notificationPermission,
  onEnableNotifications,
  syncState,
  onSyncStateChange,
  onFlushQueue,
}) {
  const { t, formatDateTime } = useWorkerI18n();
  const [data, setData] = useState(null);
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [attachmentRole, setAttachmentRole] = useState("AFTER");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [imagePreviewUrls, setImagePreviewUrls] = useState({});
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState("");

  const fetchTask = useCallback(async () => {
    try {
      const res = await api.get(`/worker/assignments/${taskId}`);
      setData(res.data?.data || null);
    } catch (err) {
      setMessage({
        type: "error",
        text: err?.response?.data?.error || t("task.error.load"),
      });
    }
  }, [taskId, t]);

  useEffect(() => {
    void fetchTask();
  }, [fetchTask]);

  const attachments = data?.attachments;

  useEffect(() => {
    let active = true;
    const objectUrls = [];
    const imageAttachments = (attachments || []).filter(isImageAttachment);

    if (!imageAttachments.length) {
      setImagePreviewUrls({});
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
        setImagePreviewUrls(nextPreviewUrls);
      }
    })();

    return () => {
      active = false;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [attachments]);

  const updateStatus = async (status) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const snapshot = queueStatusUpdate({ taskId, status, note });
      onSyncStateChange?.(snapshot);
      setMessage({ type: "info", text: t("sync.queuedStatus") });
      setNote("");
      return;
    }

    try {
      await api.patch(`/worker/assignments/${taskId}/status`, { status, note });
      setMessage({
        type: "success",
        text: status === "IN_PROGRESS" ? t("task.statusStarted") : t("task.statusResolved"),
      });
      setNote("");
      fetchTask();
    } catch (err) {
      if (!err?.response) {
        const snapshot = queueStatusUpdate({ taskId, status, note });
        onSyncStateChange?.(snapshot);
        setMessage({ type: "info", text: t("sync.queuedStatus") });
        setNote("");
        return;
      }

      setMessage({
        type: "error",
        text: err?.response?.data?.error || t("task.statusFailed"),
      });
    }
  };

  const uploadEvidence = async () => {
    if (!file) {
      setMessage({ type: "error", text: t("task.chooseFile") });
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const snapshot = await queueEvidenceUpload({ taskId, file, attachmentRole });
      onSyncStateChange?.(snapshot);
      setFile(null);
      setAttachmentRole("AFTER");
      setMessage({ type: "info", text: t("sync.queuedEvidence") });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("attachment_role", attachmentRole);
      await api.post(`/worker/assignments/${taskId}/attachments`, formData);
      setFile(null);
      setAttachmentRole("AFTER");
      setMessage({ type: "success", text: t("task.uploaded") });
      fetchTask();
    } catch (err) {
      if (!err?.response) {
        const snapshot = await queueEvidenceUpload({ taskId, file, attachmentRole });
        onSyncStateChange?.(snapshot);
        setFile(null);
        setAttachmentRole("AFTER");
        setMessage({ type: "info", text: t("sync.queuedEvidence") });
        return;
      }

      setMessage({
        type: "error",
        text: err?.response?.data?.error || t("task.uploadFailed"),
      });
    }
  };

  const downloadAttachment = async (attachment, fallbackName) => {
    try {
      setDownloadingAttachmentId(attachment.id);
      await downloadProtectedAttachment(attachment, fallbackName);
    } catch (err) {
      setMessage({
        type: "error",
        text: err?.response?.data?.error || t("task.downloadFailed"),
      });
    } finally {
      setDownloadingAttachmentId("");
    }
  };

  if (!data) {
    return (
      <div className="worker-shell">
        <WorkerHeader
          user={user}
          notificationPermission={notificationPermission}
          onEnableNotifications={onEnableNotifications}
          onOpenSettings={onOpenSettings}
          onBack={goBack}
          onLogout={onLogout}
        />
        <main className="worker-wrap">
          <section className="worker-hero-card worker-hero-card-compact">
            <div className="worker-hero-copy">
              <div className="worker-kicker">{t("task.loadingKicker")}</div>
              <h1 className="worker-title">{t("task.title")}</h1>
            </div>
          </section>

          <section className="worker-card">
            {message.text ? (
              <div className={`worker-alert worker-alert-${message.type}`}>{message.text}</div>
            ) : (
              <p className="worker-empty">{t("task.loading")}</p>
            )}
          </section>
        </main>
      </div>
    );
  }

  const { assignment, history } = data;
  const latitude = assignment.latitude != null ? Number(assignment.latitude) : null;
  const longitude = assignment.longitude != null ? Number(assignment.longitude) : null;
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const canStart = assignment.complaint_status === "ASSIGNED";
  const canResolve = assignment.complaint_status === "IN_PROGRESS";
  const imageAttachments = (attachments || []).filter(isImageAttachment);
  const fileAttachments = (attachments || []).filter((attachment) => !isImageAttachment(attachment));
  const selectedImage = imageAttachments.find((attachment) => attachment.id === selectedImageId) || null;
  const selectedImageUrl = selectedImage ? imagePreviewUrls[selectedImage.id] : "";

  return (
    <div className="worker-shell">
      <WorkerHeader
        user={user}
        notificationPermission={notificationPermission}
        onEnableNotifications={onEnableNotifications}
        onOpenSettings={onOpenSettings}
        onBack={goBack}
        onLogout={onLogout}
        status={assignment.complaint_status}
      />

      <main className="worker-wrap worker-stack-lg">
        <OfflineSyncStatus syncState={syncState} onFlushQueue={onFlushQueue} />

        <section className="worker-hero-card worker-hero-card-detail">
          <div className="worker-hero-copy">
            <div className="worker-kicker">{t("task.kicker")}</div>
            <h1 className="worker-title">{assignment.title}</h1>
            <p className="worker-subtitle worker-user-name notranslate" translate="no">
              {user.name || t("portal.workerRole")}
            </p>
          </div>
          <div className="worker-hero-meta">
            <StatusBadge status={assignment.complaint_status} />
            <span className="worker-priority-chip">
              {t("task.priority")}: {assignment.priority_level || t("task.priorityFallback")}
            </span>
            <p className="worker-hero-note">{t("task.heroNote")}</p>
          </div>
        </section>

        {message.text ? <div className={`worker-alert worker-alert-${message.type}`}>{message.text}</div> : null}

        <section className="worker-card worker-stack-lg">
          <div className="worker-section-title">
            <Wrench size={18} aria-hidden="true" />
            <span>{t("task.details")}</span>
          </div>

          <div className="worker-field-brief">
            <div className="worker-citizen-photo">
              <div className="worker-meta-label">{t("task.citizenPhoto")}</div>
              {imageAttachments[0] && imagePreviewUrls[imageAttachments[0].id] ? (
                <button
                  type="button"
                  className="worker-citizen-photo-btn"
                  onClick={() => setSelectedImageId(imageAttachments[0].id)}
                >
                  <img
                    src={imagePreviewUrls[imageAttachments[0].id]}
                    alt={t("task.imageAlt", { count: 1 })}
                  />
                </button>
              ) : (
                <div className="worker-citizen-photo-empty">{t("task.noCitizenPhoto")}</div>
              )}
            </div>

            <div className="worker-evidence-checklist">
              <div className="worker-meta-label">{t("task.evidenceChecklist")}</div>
              <div><CheckCircle2 size={16} aria-hidden="true" />{t("task.evidenceBefore")}</div>
              <div><CheckCircle2 size={16} aria-hidden="true" />{t("task.evidenceAfter")}</div>
              <div><CheckCircle2 size={16} aria-hidden="true" />{t("task.evidenceNote")}</div>
            </div>
          </div>

          <div className="worker-detail-grid">
            <div>
              <span className="worker-meta-label">{t("task.meta.department")}</span>
              <span>{assignment.department_name || t("status.unknown")}</span>
            </div>
            <div>
              <span className="worker-meta-label">{t("task.meta.issueType")}</span>
              <span>{assignment.complaint_type || t("status.unknown")}</span>
            </div>
            <div>
              <span className="worker-meta-label">{t("task.meta.assigned")}</span>
              <span>{assignment.assigned_at ? formatDateTime(assignment.assigned_at) : t("status.unknown")}</span>
            </div>
            <div>
              <span className="worker-meta-label">{t("task.meta.description")}</span>
              <span>{assignment.description || t("task.meta.noDescription")}</span>
            </div>
          </div>

          {assignment.address_text || hasCoordinates ? (
            <div className="worker-location-card">
              <div className="worker-section-title">
                <MapPinned size={18} aria-hidden="true" />
                <span>{t("task.location")}</span>
              </div>
              <p>
                {assignment.address_text
                  || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
              </p>
              {hasCoordinates ? (
                <a
                  className="worker-link-chip"
                  href={buildMapsUrl(latitude, longitude)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation size={18} aria-hidden="true" />
                  <span>{t("task.openNavigation")}</span>
                </a>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="worker-card worker-stack-lg">
          <div className="worker-section-title">
            <Play size={18} aria-hidden="true" />
            <span>{t("task.updateStatus")}</span>
          </div>
          <textarea
            className="worker-textarea"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            placeholder={t("task.notePlaceholder")}
          />

          <div className="worker-actions">
            <button
              type="button"
              className="worker-primary-btn worker-btn-with-icon"
              onClick={() => updateStatus("IN_PROGRESS")}
              disabled={!canStart}
            >
              <Play size={18} aria-hidden="true" />
              <span>{t("task.start")}</span>
            </button>
            <button
              type="button"
              className="worker-primary-btn worker-success-btn worker-btn-with-icon"
              onClick={() => updateStatus("RESOLVED")}
              disabled={!canResolve}
            >
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>{t("task.resolve")}</span>
            </button>
          </div>
        </section>

        <section className="worker-card worker-stack-lg">
          <div className="worker-section-title">
            <Upload size={18} aria-hidden="true" />
            <span>{t("task.upload")}</span>
          </div>
          <div className="worker-upload-grid">
            <input
              className="worker-file-input"
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <select
              className="worker-select"
              value={attachmentRole}
              onChange={(event) => setAttachmentRole(event.target.value)}
            >
              <option value="AFTER">{t("task.attachmentRole.after")}</option>
              <option value="BEFORE">{t("task.attachmentRole.before")}</option>
              <option value="GENERAL">{t("task.attachmentRole.general")}</option>
            </select>
          </div>
          <p className="worker-section-copy">{t("task.uploadCopy")}</p>
          {file ? (
            <div className="worker-inline-tip">
              <FileImage size={16} aria-hidden="true" />
              <span>{file.name}</span>
            </div>
          ) : null}
          <button
            type="button"
            className="worker-primary-btn worker-btn-with-icon"
            onClick={uploadEvidence}
          >
            <Upload size={18} aria-hidden="true" />
            <span>{t("task.upload")}</span>
          </button>
        </section>

        <section className="worker-card worker-stack-lg">
          <div className="worker-section-title">
            <FileImage size={18} aria-hidden="true" />
            <span>{t("task.gallery")}</span>
          </div>
          {imageAttachments.length ? (
            <div className="worker-attachment-grid">
              {imageAttachments.map((attachment, index) => {
                const previewUrl = imagePreviewUrls[attachment.id];
                return (
                  <button
                    type="button"
                    key={attachment.id}
                    className="worker-attachment-tile"
                    onClick={() => previewUrl && setSelectedImageId(attachment.id)}
                  >
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={t("task.imageAlt", { count: index + 1 })}
                        className="worker-attachment-thumb"
                      />
                    ) : (
                      <div className="worker-attachment-placeholder">{t("task.previewLoading")}</div>
                    )}
                    <div className="worker-attachment-meta">
                      <span className={`worker-role-badge worker-role-badge-${attachment.attachment_role.toLowerCase()}`}>
                        {getAttachmentRoleLabel(attachment.attachment_role, t)}
                      </span>
                      <span>{formatDateTime(attachment.created_at)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="worker-empty worker-empty-inline">{t("task.noImageEvidence")}</p>
          )}

          <div className="worker-section-title">
            <Files size={18} aria-hidden="true" />
            <span>{t("task.otherAttachments")}</span>
          </div>
          {fileAttachments.length ? (
            <div className="worker-attachment-file-list">
              {fileAttachments.map((attachment, index) => {
                const fallbackName = getAttachmentFileName(attachment, index);
                return (
                  <div key={attachment.id} className="worker-attachment-file-row">
                    <div className="worker-attachment-file-copy">
                      <span className="worker-role-badge worker-role-badge-general">
                        {getAttachmentRoleLabel(attachment.attachment_role, t)}
                      </span>
                      <strong>{fallbackName}</strong>
                      <span>{attachment.file_type || t("task.otherFileType")}</span>
                    </div>
                    <button
                      type="button"
                      className="worker-secondary-btn worker-btn-with-icon"
                      disabled={downloadingAttachmentId === attachment.id}
                      onClick={() => downloadAttachment(attachment, fallbackName)}
                    >
                      <Download size={18} aria-hidden="true" />
                      <span>{downloadingAttachmentId === attachment.id ? t("task.downloading") : t("task.download")}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="worker-empty worker-empty-inline">{t("task.noOtherEvidence")}</p>
          )}
        </section>

        <section className="worker-card">
          <ComplaintTimeline history={history} />
        </section>
      </main>

      {selectedImage && selectedImageUrl ? (
        <div className="worker-lightbox-backdrop" onClick={() => setSelectedImageId(null)}>
          <div className="worker-lightbox-card" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="worker-lightbox-close"
              onClick={() => setSelectedImageId(null)}
            >
              {t("common.close")}
            </button>
            <img
              src={selectedImageUrl}
              alt={t("task.selectedEvidence")}
              className="worker-lightbox-image"
            />
            <div className="worker-lightbox-meta">
              <span className={`worker-role-badge worker-role-badge-${selectedImage.attachment_role.toLowerCase()}`}>
                {getAttachmentRoleLabel(selectedImage.attachment_role, t)}
              </span>
              <span>{formatDateTime(selectedImage.created_at)}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
