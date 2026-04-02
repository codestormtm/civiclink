import { useEffect, useState } from "react";
import api from "../api/api";
import {
  getLastTrackedComplaintId,
  getRecentComplaintRefs,
  rememberTrackedComplaint,
  removeRecentComplaintRef,
  setLastTrackedComplaintId,
} from "../utils/portalState";

const STATUS_ORDER = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"];

const STATUS_META = {
  SUBMITTED: { label: "Submitted", color: "#1e40af", bg: "#eff6ff" },
  ASSIGNED: { label: "Assigned", color: "#5b21b6", bg: "#f5f3ff" },
  IN_PROGRESS: { label: "In Progress", color: "#164e63", bg: "#ecfeff" },
  RESOLVED: { label: "Resolved", color: "#065f46", bg: "#ecfdf5" },
  CLOSED: { label: "Closed", color: "#374151", bg: "#f3f4f6" },
  REJECTED_WRONG_DEPARTMENT: { label: "Rejected", color: "#991b1b", bg: "#fef2f2" },
};

const STATUS_DESC = {
  SUBMITTED: "Your complaint has been received and is awaiting review.",
  ASSIGNED: "A field worker has been assigned to your complaint.",
  IN_PROGRESS: "Work is currently underway on your complaint.",
  RESOLVED: "Your complaint has been resolved. Thank you.",
  CLOSED: "This complaint has been closed.",
  REJECTED_WRONG_DEPARTMENT: "This complaint was redirected or rejected. See timeline for details.",
};

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

function StatusSteps({ status }) {
  const currentIndex = STATUS_ORDER.indexOf(status);
  const isRejected = status === "REJECTED_WRONG_DEPARTMENT" || status === "CLOSED";

  return (
    <div style={{ margin: "20px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {STATUS_ORDER.map((step, index) => {
          const done = !isRejected && index <= currentIndex;
          const active = !isRejected && index === currentIndex;
          return (
            <div key={step} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: done ? "#1a56db" : "#e5e7eb",
                    border: active ? "3px solid #0e9f6e" : "3px solid transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: done ? "#fff" : "#9ca3af",
                    fontSize: 13,
                    fontWeight: 700,
                    transition: "all 0.2s",
                  }}
                >
                  {done ? (index === currentIndex && !isRejected ? index + 1 : "✓") : index + 1}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    marginTop: 5,
                    fontWeight: 600,
                    color: done ? "#1a56db" : "#9ca3af",
                    textAlign: "center",
                    letterSpacing: "0.4px",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {STATUS_META[step].label}
                </div>
              </div>
              {index < STATUS_ORDER.length - 1 && (
                <div
                  style={{
                    height: 3,
                    flex: 1,
                    marginBottom: 18,
                    background: !isRejected && index < currentIndex ? "#1a56db" : "#e5e7eb",
                    transition: "background 0.2s",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {isRejected && (
        <div
          style={{
            marginTop: 10,
            padding: "8px 14px",
            background: "#fee2e2",
            borderRadius: 4,
            fontSize: 12,
            color: "#b91c1c",
            fontWeight: 600,
            border: "1px solid #fecaca",
          }}
        >
          {STATUS_META[status]?.label || status}
        </div>
      )}
    </div>
  );
}

function Timeline({ events }) {
  if (!events || events.length === 0) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.7px",
          color: "#6b7280",
          marginBottom: 14,
        }}
      >
        Complaint Timeline
      </div>
      <div style={{ position: "relative", paddingLeft: 24 }}>
        <div
          style={{
            position: "absolute",
            left: 7,
            top: 0,
            bottom: 0,
            width: 2,
            background: "#e5e7eb",
          }}
        />
        {events.map((event, index) => (
          <div key={index} style={{ position: "relative", marginBottom: 20 }}>
            <div
              style={{
                position: "absolute",
                left: -21,
                top: 2,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#1a56db",
                border: "2px solid #0e9f6e",
              }}
            />
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0d3b2e" }}>
              {event.event}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", margin: "2px 0" }}>
              {event.description}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              {new Date(event.timestamp).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrackComplaint() {
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
        setAttachmentPreviewUrls(nextPreviewUrls);
      }
    })();

    return () => {
      active = false;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [result]);

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
      const message = err?.response?.data?.error || err?.response?.data?.message || "Complaint not found. Please check your ID.";

      if (status === 404 && options.fromStored) {
        pruneStoredComplaintId(normalizedId);
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const restoreLastTrackedComplaint = async () => {
      const lastTrackedId = getLastTrackedComplaintId();
      if (!lastTrackedId) {
        return;
      }

      try {
        setError("");
        setResult(null);
        setLoading(true);
        setComplaintId(lastTrackedId);

        const res = await api.get(`/citizen-complaints/track/${lastTrackedId}`);
        setResult(res.data.data);
        rememberTrackedComplaint(lastTrackedId);
        setRecentRefs(getRecentComplaintRefs());
      } catch (err) {
        if (err?.response?.status === 404) {
          removeRecentComplaintRef(lastTrackedId);
          if (getLastTrackedComplaintId() === lastTrackedId) {
            setLastTrackedComplaintId("");
          }
          setRecentRefs(getRecentComplaintRefs());
        }
        setError(err?.response?.data?.error || err?.response?.data?.message || "Complaint not found. Please check your ID.");
      } finally {
        setLoading(false);
      }
    };

    restoreLastTrackedComplaint();
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      trackComplaint();
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
      setError(err?.response?.data?.error || "Failed to download attachment.");
    } finally {
      setDownloadingAttachmentId("");
    }
  };

  const complaint = result?.complaint;
  const meta = complaint ? (STATUS_META[complaint.status] || STATUS_META.SUBMITTED) : null;
  const imageAttachments = (result?.attachments || []).filter(isImageAttachment);
  const fileAttachments = (result?.attachments || []).filter((attachment) => !isImageAttachment(attachment));
  const selectedImage = imageAttachments.find((attachment) => attachment.id === selectedImageId) || null;
  const selectedImageUrl = selectedImage ? attachmentPreviewUrls[selectedImage.id] : "";

  return (
    <div className="container">
      <div className="page-heading">
        <h2>Track Your Complaint</h2>
        <p>Enter your complaint ID to view its current status and history.</p>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Paste your complaint ID here"
            value={complaintId}
            onChange={(event) => setComplaintId(event.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1, minWidth: 260 }}
          />
          <button
            onClick={() => trackComplaint()}
            disabled={loading}
            style={{
              background: "#1a56db",
              color: "#fff",
              border: "2px solid #1a56db",
              borderRadius: 8,
              padding: "10px 22px",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              whiteSpace: "nowrap",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Searching..." : "Track"}
          </button>
        </div>

        {recentRefs.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#6b7280",
                marginBottom: 8,
              }}
            >
              Recent complaint IDs
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {recentRefs.map((ref) => (
                <button
                  key={ref}
                  type="button"
                  onClick={() => trackComplaint(ref, { fromStored: true })}
                  style={{
                    width: "auto",
                    padding: "7px 12px",
                    borderRadius: 999,
                    border: "1px solid var(--sl-line)",
                    background: ref === complaintId ? "#fff0c7" : "#fff",
                    color: "var(--sl-ink-900)",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "monospace",
                  }}
                >
                  {ref}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="alert alert-error" style={{ marginTop: 14 }}>{error}</div>}
      </div>

      {result && complaint && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>{complaint.title}</h3>
            <span
              style={{
                background: meta.bg,
                color: meta.color,
                padding: "4px 12px",
                borderRadius: 3,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.6px",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {meta.label}
            </span>
          </div>

          <div
            style={{
              background: "#f8faf9",
              border: "1px solid #dde3ea",
              borderLeft: `4px solid ${meta.color}`,
              borderRadius: 4,
              padding: "10px 14px",
              fontSize: 13,
              color: "#374151",
              marginBottom: 16,
            }}
          >
            {STATUS_DESC[complaint.status]}
          </div>

          <StatusSteps status={complaint.status} />

          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
            {[
              ["Complaint ID", (
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12 }}>{complaint.id}</span>
                  <button
                    onClick={copyId}
                    style={{
                      background: copied ? "#dcfce7" : "#f1f5f9",
                      border: "1px solid #dde3ea",
                      color: copied ? "#15803d" : "#374151",
                      padding: "2px 10px",
                      borderRadius: 3,
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: 600,
                      width: "auto",
                    }}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </span>
              )],
              ["Department", complaint.department_name],
              ["Type", complaint.complaint_type],
              ["Description", complaint.description],
              ["Submitted", new Date(complaint.submitted_at).toLocaleString()],
              ...(complaint.resolved_at ? [["Resolved", new Date(complaint.resolved_at).toLocaleString()]] : []),
              ...(complaint.rejection_reason ? [["Rejection Reason", complaint.rejection_reason]] : []),
            ].map(([label, value]) => (
              <div key={label} className="result-row">
                <strong>{label}</strong>
                <span>{value}</span>
              </div>
            ))}
          </div>

          {result.timeline && result.timeline.length > 0 && (
            <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 8 }}>
              <Timeline events={result.timeline} />
            </div>
          )}

          <div className="attachments-section">
            <div className="attachments-title">Image Gallery</div>
            {imageAttachments.length === 0 ? (
              <p className="empty-text">No image attachments uploaded.</p>
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
                        <div className="attachment-gallery-placeholder">Loading preview...</div>
                      )}
                      <div className="attachment-gallery-meta">
                        <span className={`attachment-role-badge attachment-role-badge-${attachment.attachment_role.toLowerCase()}`}>
                          {getAttachmentRoleLabel(attachment.attachment_role)}
                        </span>
                        <span>{new Date(attachment.created_at).toLocaleString()}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="attachments-section">
            <div className="attachments-title">Other Attachments</div>
            {fileAttachments.length === 0 ? (
              <p className="empty-text">No non-image attachments uploaded.</p>
            ) : (
              <div className="attachment-file-list">
                {fileAttachments.map((attachment, index) => {
                  const fallbackName = getAttachmentFileName(attachment, index);
                  return (
                    <div key={attachment.id} className="attachment-file-row">
                      <div className="attachment-file-copy">
                        <span className={`attachment-role-badge attachment-role-badge-${attachment.attachment_role.toLowerCase()}`}>
                          {getAttachmentRoleLabel(attachment.attachment_role)}
                        </span>
                        <strong>{fallbackName}</strong>
                        <span>{attachment.file_type || "Unknown file type"}</span>
                      </div>
                      <button
                        type="button"
                        className="attachment-download-btn"
                        disabled={downloadingAttachmentId === attachment.id}
                        onClick={() => downloadAttachment(attachment, fallbackName)}
                      >
                        {downloadingAttachmentId === attachment.id ? "Downloading..." : "Download"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedImage && selectedImageUrl && (
        <div className="attachment-lightbox-backdrop" onClick={() => setSelectedImageId(null)}>
          <div className="attachment-lightbox-card" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="attachment-lightbox-close"
              onClick={() => setSelectedImageId(null)}
            >
              Close
            </button>
            <img
              src={selectedImageUrl}
              alt="Selected complaint attachment"
              className="attachment-lightbox-image"
            />
            <div className="attachment-gallery-meta">
              <span className={`attachment-role-badge attachment-role-badge-${selectedImage.attachment_role.toLowerCase()}`}>
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
