import { useEffect, useState } from "react";
import api from "../api/api";

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

export default function AdminComplaintGalleryModal({ detail, loading, error, onClose }) {
  const [previewUrls, setPreviewUrls] = useState({});
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [downloadError, setDownloadError] = useState("");
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState("");

  useEffect(() => {
    let active = true;
    const objectUrls = [];
    const imageAttachments = (detail?.attachments || []).filter(isImageAttachment);

    if (!imageAttachments.length) {
      setPreviewUrls({});
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
        setPreviewUrls(nextPreviewUrls);
      }
    })();

    return () => {
      active = false;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [detail]);

  const downloadAttachment = async (attachment, fallbackName) => {
    try {
      setDownloadError("");
      setDownloadingAttachmentId(attachment.id);
      await downloadProtectedAttachment(attachment, fallbackName);
    } catch (err) {
      setDownloadError(err?.response?.data?.error || "Failed to download attachment.");
    } finally {
      setDownloadingAttachmentId("");
    }
  };

  const attachments = detail?.attachments || [];
  const beforeImages = attachments.filter((attachment) => isImageAttachment(attachment) && attachment.attachment_role === "BEFORE");
  const afterImages = attachments.filter((attachment) => isImageAttachment(attachment) && attachment.attachment_role === "AFTER");
  const otherAttachments = attachments.filter((attachment) => !isImageAttachment(attachment) || attachment.attachment_role === "GENERAL");
  const selectedImage = attachments.find((attachment) => attachment.id === selectedImageId) || null;
  const selectedImageUrl = selectedImage ? previewUrls[selectedImage.id] : "";

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-card admin-gallery-modal" onClick={(event) => event.stopPropagation()}>
          <div className="admin-gallery-modal-head">
            <div>
              <h3 className="modal-title">{detail?.complaint?.title || "Complaint gallery"}</h3>
              <p className="modal-copy">
                Review complaint evidence in one place, compare before and after photos, and download any extra files.
              </p>
            </div>
            <button type="button" className="topbar-logout" onClick={onClose}>
              Close
            </button>
          </div>

          {loading && <p className="empty">Loading complaint gallery...</p>}
          {error && <div className="alert alert-error">{error}</div>}
          {downloadError && <div className="alert alert-error">{downloadError}</div>}

          {detail && !loading && (
            <>
              <div className="admin-gallery-summary">
                <div className="admin-gallery-summary-box">
                  <strong>Department</strong>
                  <span>{detail.complaint.department_name}</span>
                </div>
                <div className="admin-gallery-summary-box">
                  <strong>Issue Type</strong>
                  <span>{detail.complaint.issue_type_name}</span>
                </div>
                <div className="admin-gallery-summary-box">
                  <strong>Reporter</strong>
                  <span>{detail.complaint.reporter_name}</span>
                </div>
                <div className="admin-gallery-summary-box">
                  <strong>Assigned Worker</strong>
                  <span>{detail.complaint.assigned_worker_name || "Not assigned"}</span>
                </div>
              </div>

              <div className="admin-gallery-columns">
                <section className="admin-gallery-column">
                  <div className="admin-gallery-column-head">
                    <span className="admin-gallery-role admin-gallery-role-before">Before</span>
                    <span>{beforeImages.length} image{beforeImages.length === 1 ? "" : "s"}</span>
                  </div>
                  {beforeImages.length === 0 ? (
                    <div className="admin-gallery-empty">No before images uploaded for this complaint.</div>
                  ) : (
                    <div className="admin-gallery-grid">
                      {beforeImages.map((attachment, index) => (
                        <button
                          type="button"
                          key={attachment.id}
                          className="admin-gallery-tile"
                          onClick={() => previewUrls[attachment.id] && setSelectedImageId(attachment.id)}
                        >
                          {previewUrls[attachment.id] ? (
                            <img
                              src={previewUrls[attachment.id]}
                              alt={`Before evidence ${index + 1}`}
                              className="admin-gallery-image"
                            />
                          ) : (
                            <div className="admin-gallery-placeholder">Loading preview...</div>
                          )}
                          <span>{new Date(attachment.created_at).toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="admin-gallery-column">
                  <div className="admin-gallery-column-head">
                    <span className="admin-gallery-role admin-gallery-role-after">After</span>
                    <span>{afterImages.length} image{afterImages.length === 1 ? "" : "s"}</span>
                  </div>
                  {afterImages.length === 0 ? (
                    <div className="admin-gallery-empty">No after images uploaded for this complaint.</div>
                  ) : (
                    <div className="admin-gallery-grid">
                      {afterImages.map((attachment, index) => (
                        <button
                          type="button"
                          key={attachment.id}
                          className="admin-gallery-tile"
                          onClick={() => previewUrls[attachment.id] && setSelectedImageId(attachment.id)}
                        >
                          {previewUrls[attachment.id] ? (
                            <img
                              src={previewUrls[attachment.id]}
                              alt={`After evidence ${index + 1}`}
                              className="admin-gallery-image"
                            />
                          ) : (
                            <div className="admin-gallery-placeholder">Loading preview...</div>
                          )}
                          <span>{new Date(attachment.created_at).toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <section className="admin-gallery-files">
                <div className="admin-gallery-column-head">
                  <span className="admin-gallery-role admin-gallery-role-general">Other attachments</span>
                  <span>{otherAttachments.length}</span>
                </div>
                {otherAttachments.length === 0 ? (
                  <div className="admin-gallery-empty">No other attachments uploaded for this complaint.</div>
                ) : (
                  <div className="admin-gallery-file-list">
                    {otherAttachments.map((attachment, index) => {
                      const fallbackName = getAttachmentFileName(attachment, index);
                      return (
                        <div key={attachment.id} className="admin-gallery-file-row">
                          <div className="admin-gallery-file-copy">
                            <span className={`admin-gallery-role admin-gallery-role-${attachment.attachment_role.toLowerCase()}`}>
                              {getAttachmentRoleLabel(attachment.attachment_role)}
                            </span>
                            <strong>{fallbackName}</strong>
                            <span>{attachment.file_type || "Unknown file type"}</span>
                          </div>
                          <button
                            type="button"
                            className="topbar-logout"
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
              </section>

              <section className="admin-gallery-history">
                <div className="admin-gallery-column-head">
                  <span className="admin-gallery-role admin-gallery-role-general">Status history</span>
                  <span>{detail.history.length} events</span>
                </div>
                {detail.history.length === 0 ? (
                  <div className="admin-gallery-empty">No complaint history recorded yet.</div>
                ) : (
                  <div className="admin-gallery-history-list">
                    {detail.history.map((entry) => (
                      <div key={entry.id} className="admin-gallery-history-item">
                        <strong>{entry.new_status.replace(/_/g, " ")}</strong>
                        <span>{entry.note || "Status updated"}</span>
                        <span>
                          {new Date(entry.created_at).toLocaleString()}
                          {entry.changed_by_name ? ` · ${entry.changed_by_name}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {selectedImage && selectedImageUrl && (
        <div className="modal-backdrop" onClick={() => setSelectedImageId(null)}>
          <div className="modal-card admin-gallery-lightbox" onClick={(event) => event.stopPropagation()}>
            <div className="admin-gallery-modal-head">
              <div>
                <h3 className="modal-title">Attachment preview</h3>
                <p className="modal-copy">
                  {getAttachmentRoleLabel(selectedImage.attachment_role)} image · {new Date(selectedImage.created_at).toLocaleString()}
                </p>
              </div>
              <button type="button" className="topbar-logout" onClick={() => setSelectedImageId(null)}>
                Close
              </button>
            </div>
            <img
              src={selectedImageUrl}
              alt="Complaint evidence preview"
              className="admin-gallery-lightbox-image"
            />
          </div>
        </div>
      )}
    </>
  );
}
