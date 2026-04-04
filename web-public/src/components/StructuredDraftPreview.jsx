import { useEffect, useState } from "react";
import { useCitizenI18n } from "../i18n";
import { ArrowRightIcon, EditIcon, ImageIcon } from "./PublicIcons";

export default function StructuredDraftPreview({
  draft,
  onSubmit,
  onEdit,
  submitting,
  attachmentFile,
  onAttachmentChange,
  attachmentError = "",
}) {
  const { t } = useCitizenI18n();
  const [editMode, setEditMode] = useState(false);
  const [localDraft, setLocalDraft] = useState(draft);

  useEffect(() => {
    setLocalDraft(draft);
  }, [draft]);

  const fields = [
    { key: "title", label: t("preview.titleField") },
    { key: "description", label: t("preview.descriptionField"), multiline: true },
    { key: "address_text", label: t("preview.locationField") },
  ];

  const handleSubmit = () => {
    onSubmit(editMode ? localDraft : draft);
  };

  return (
    <div className="citizen-preview-card">
      <div className="citizen-preview-header">
        <div>
          <div className="citizen-preview-title">{t("preview.title")}</div>
          <div className="citizen-preview-subtitle">{t("preview.subtitle")}</div>
        </div>
        <button
          onClick={() => {
            setEditMode((value) => !value);
            setLocalDraft(draft);
          }}
          className="citizen-action-btn is-outline"
        >
          <EditIcon size={16} />
          {editMode ? t("preview.cancelEdit") : t("preview.edit")}
        </button>
      </div>

      {fields.map(({ key, label, multiline }) => (
        <div key={key} className="citizen-preview-field">
          <div className="citizen-preview-field-label">{label}</div>
          {editMode ? (
            multiline ? (
              <textarea
                value={localDraft[key] || ""}
                onChange={(event) => setLocalDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                rows={4}
                className="citizen-preview-input citizen-preview-textarea"
              />
            ) : (
              <input
                value={localDraft[key] || ""}
                onChange={(event) => setLocalDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                className="citizen-preview-input"
              />
            )
          ) : (
            <div className={`citizen-preview-field-value ${draft[key] ? "" : "is-empty"}`}>
              {draft[key] || t("common.notProvided")}
            </div>
          )}
        </div>
      ))}

      <div className="citizen-preview-upload-card">
        <div className="citizen-preview-upload-label">{t("preview.evidence")}</div>
        <label className="citizen-upload-picker">
          <ImageIcon size={16} />
          <span>{attachmentFile ? t("preview.replacePhoto") : t("preview.choosePhoto")}</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => onAttachmentChange(event.target.files?.[0] || null)}
          />
        </label>
        <div className="citizen-preview-upload-copy">{t("preview.photoCopy")}</div>
        {attachmentFile ? (
          <div className="citizen-preview-upload-file">
            {t("preview.selectedFile", { name: attachmentFile.name })}
          </div>
        ) : null}
        {attachmentError ? (
          <div className="alert alert-error" style={{ marginTop: 12, marginBottom: 0 }}>
            {attachmentError}
          </div>
        ) : null}
      </div>

      <div className="citizen-preview-actions">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="citizen-action-btn is-maroon citizen-action-btn-flex"
        >
          <ArrowRightIcon size={16} />
          {submitting ? t("complaint.submitting") : t("complaint.submit")}
        </button>
        <button onClick={onEdit} className="citizen-action-btn is-soft">
          <EditIcon size={16} />
          {t("preview.continueChat")}
        </button>
      </div>
    </div>
  );
}
