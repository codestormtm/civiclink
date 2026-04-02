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
import ComplaintTimeline from "../components/ComplaintTimeline";
import StatusBadge from "../components/StatusBadge";
import WorkerHeader from "../components/WorkerHeader";

function buildMapsUrl(latitude, longitude) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

function getAttachmentRoleLabel(role) {
  if (role === "BEFORE") return "Before";
  if (role === "AFTER") return "After";
  return "General";
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
  language,
  onLanguageChange,
  notificationPermission,
  onEnableNotifications,
}) {
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
        text: err?.response?.data?.error || "Failed to load task details.",
      });
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
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

    (async () => {
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
        })
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
    try {
      await api.patch(`/worker/assignments/${taskId}/status`, { status, note });
      setMessage({
        type: "success",
        text: status === "IN_PROGRESS" ? "Task started successfully." : "Task marked as resolved.",
      });
      setNote("");
      fetchTask();
    } catch (err) {
      setMessage({
        type: "error",
        text: err?.response?.data?.error || "Failed to update status.",
      });
    }
  };

  const uploadEvidence = async () => {
    if (!file) {
      setMessage({ type: "error", text: "Choose a file before uploading evidence." });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("attachment_role", attachmentRole);
      await api.post(`/worker/assignments/${taskId}/attachments`, formData);
      setFile(null);
      setAttachmentRole("AFTER");
      setMessage({ type: "success", text: "Evidence uploaded successfully." });
      fetchTask();
    } catch (err) {
      setMessage({
        type: "error",
        text: err?.response?.data?.error || "Failed to upload evidence.",
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
        text: err?.response?.data?.error || "Failed to download attachment.",
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
          language={language}
          onLanguageChange={onLanguageChange}
          notificationPermission={notificationPermission}
          onEnableNotifications={onEnableNotifications}
          onBack={goBack}
          onLogout={onLogout}
        />
        <main className="worker-wrap">
          <section className="worker-hero-card worker-hero-card-compact">
            <div className="worker-hero-copy">
              <div className="worker-kicker">Field Operations</div>
              <h1 className="worker-title">Task detail</h1>
            </div>
          </section>

          <section className="worker-card">
            {message.text ? (
              <div className={`worker-alert worker-alert-${message.type}`}>{message.text}</div>
            ) : (
              <p className="worker-empty">Loading task details...</p>
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
        language={language}
        onLanguageChange={onLanguageChange}
        notificationPermission={notificationPermission}
        onEnableNotifications={onEnableNotifications}
        onBack={goBack}
        onLogout={onLogout}
        status={assignment.complaint_status}
      />

      <main className="worker-wrap worker-stack-lg">
        <section className="worker-hero-card worker-hero-card-detail">
          <div className="worker-hero-copy">
            <div className="worker-kicker">Assigned task</div>
            <h1 className="worker-title">{assignment.title}</h1>
            <p className="worker-subtitle worker-user-name notranslate" translate="no">
              {user.name || "Worker"}
            </p>
          </div>
          <div className="worker-hero-meta">
            <StatusBadge status={assignment.complaint_status} />
            <p className="worker-hero-note">Update progress in the field, keep the department informed, and close the complaint with evidence.</p>
          </div>
        </section>

        {message.text && (
          <div className={`worker-alert worker-alert-${message.type}`}>{message.text}</div>
        )}

        <section className="worker-card worker-stack-lg">
          <div className="worker-section-title">
            <Wrench size={18} aria-hidden="true" />
            <span>Complaint Details</span>
          </div>

          <div className="worker-detail-grid">
            <div>
              <span className="worker-meta-label">Department</span>
              <span>{assignment.department_name || "Unknown"}</span>
            </div>
            <div>
              <span className="worker-meta-label">Issue Type</span>
              <span>{assignment.complaint_type || "Unknown"}</span>
            </div>
            <div>
              <span className="worker-meta-label">Assigned</span>
              <span>{assignment.assigned_at ? new Date(assignment.assigned_at).toLocaleString() : "Unknown"}</span>
            </div>
            <div>
              <span className="worker-meta-label">Description</span>
              <span>{assignment.description || "No description provided."}</span>
            </div>
          </div>

          {(assignment.address_text || hasCoordinates) && (
            <div className="worker-location-card">
              <div className="worker-section-title">
                <MapPinned size={18} aria-hidden="true" />
                <span>Location</span>
              </div>
              <p>
                {assignment.address_text
                  || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
              </p>
              {hasCoordinates && (
                <a
                  className="worker-link-chip"
                  href={buildMapsUrl(latitude, longitude)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation size={18} aria-hidden="true" />
                  <span>Open Navigation</span>
                </a>
              )}
            </div>
          )}
        </section>

        <section className="worker-card worker-stack-lg">
          <div className="worker-section-title">
            <Play size={18} aria-hidden="true" />
            <span>Update Work Status</span>
          </div>
          <textarea
            className="worker-textarea"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            placeholder="Add a field note or progress update..."
          />

          <div className="worker-actions">
            <button
              type="button"
              className="worker-primary-btn worker-btn-with-icon"
              onClick={() => updateStatus("IN_PROGRESS")}
              disabled={!canStart}
            >
              <Play size={18} aria-hidden="true" />
              <span>Start Work</span>
            </button>
            <button
              type="button"
              className="worker-primary-btn worker-success-btn worker-btn-with-icon"
              onClick={() => updateStatus("RESOLVED")}
              disabled={!canResolve}
            >
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>Mark Resolved</span>
            </button>
          </div>
        </section>

        <section className="worker-card worker-stack-lg">
          <div className="worker-section-title">
            <Upload size={18} aria-hidden="true" />
            <span>Upload Evidence</span>
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
              <option value="AFTER">After photo</option>
              <option value="BEFORE">Before photo</option>
              <option value="GENERAL">General attachment</option>
            </select>
          </div>
          <p className="worker-section-copy">
            Image uploads keep the selected role. Non-image files are stored as general attachments automatically.
          </p>
          {file ? <div className="worker-inline-tip"><FileImage size={16} aria-hidden="true" /><span>{file.name}</span></div> : null}
          <button
            type="button"
            className="worker-primary-btn worker-btn-with-icon"
            onClick={uploadEvidence}
          >
            <Upload size={18} aria-hidden="true" />
            <span>Upload Evidence</span>
          </button>
        </section>

        <section className="worker-card worker-stack-lg">
          <div className="worker-section-title">
            <FileImage size={18} aria-hidden="true" />
            <span>Evidence Gallery</span>
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
                        alt={`Complaint evidence ${index + 1}`}
                        className="worker-attachment-thumb"
                      />
                    ) : (
                      <div className="worker-attachment-placeholder">Loading preview...</div>
                    )}
                    <div className="worker-attachment-meta">
                      <span className={`worker-role-badge worker-role-badge-${attachment.attachment_role.toLowerCase()}`}>
                        {getAttachmentRoleLabel(attachment.attachment_role)}
                      </span>
                      <span>{new Date(attachment.created_at).toLocaleString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="worker-empty worker-empty-inline">No image evidence uploaded yet.</p>
          )}

          <div className="worker-section-title">
            <Files size={18} aria-hidden="true" />
            <span>Other Attachments</span>
          </div>
          {fileAttachments.length ? (
            <div className="worker-attachment-file-list">
              {fileAttachments.map((attachment, index) => {
                const fallbackName = getAttachmentFileName(attachment, index);
                return (
                  <div key={attachment.id} className="worker-attachment-file-row">
                    <div className="worker-attachment-file-copy">
                      <span className="worker-role-badge worker-role-badge-general">
                        {getAttachmentRoleLabel(attachment.attachment_role)}
                      </span>
                      <strong>{fallbackName}</strong>
                      <span>{attachment.file_type || "Unknown file type"}</span>
                    </div>
                    <button
                      type="button"
                      className="worker-secondary-btn worker-btn-with-icon"
                      disabled={downloadingAttachmentId === attachment.id}
                      onClick={() => downloadAttachment(attachment, fallbackName)}
                    >
                      <Download size={18} aria-hidden="true" />
                      <span>{downloadingAttachmentId === attachment.id ? "Downloading..." : "Download"}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="worker-empty worker-empty-inline">No non-image attachments uploaded yet.</p>
          )}
        </section>

        <section className="worker-card">
          <ComplaintTimeline history={history} />
        </section>
      </main>

      {selectedImage && selectedImageUrl && (
        <div className="worker-lightbox-backdrop" onClick={() => setSelectedImageId(null)}>
          <div className="worker-lightbox-card" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="worker-lightbox-close"
              onClick={() => setSelectedImageId(null)}
            >
              Close
            </button>
            <img
              src={selectedImageUrl}
              alt="Selected complaint evidence"
              className="worker-lightbox-image"
            />
            <div className="worker-lightbox-meta">
              <span className={`worker-role-badge worker-role-badge-${selectedImage.attachment_role.toLowerCase()}`}>
                {getAttachmentRoleLabel(selectedImage.attachment_role)}
              </span>
              <span>{new Date(selectedImage.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
