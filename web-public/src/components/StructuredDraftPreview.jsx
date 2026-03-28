import { useState } from "react";

export default function StructuredDraftPreview({ draft, onSubmit, onEdit, submitting }) {
  const [editMode, setEditMode] = useState(false);
  const [localDraft, setLocalDraft] = useState(draft);

  const fields = [
    { key: "title", label: "Title" },
    { key: "description", label: "Description", multiline: true },
    { key: "address_text", label: "Location" },
  ];

  const handleSubmit = () => {
    onSubmit(editMode ? localDraft : draft);
  };

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: 20,
      marginTop: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>Complaint Summary</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Review before submitting</div>
        </div>
        <button
          onClick={() => { setEditMode((v) => !v); setLocalDraft(draft); }}
          style={{
            fontSize: 12, fontWeight: 600, color: "#1a56db",
            background: "none", border: "1px solid #1a56db",
            borderRadius: 6, padding: "5px 12px", cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {editMode ? "Cancel Edit" : "✏ Edit Details"}
        </button>
      </div>

      {fields.map(({ key, label, multiline }) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>
            {label}
          </div>
          {editMode ? (
            multiline ? (
              <textarea
                value={localDraft[key] || ""}
                onChange={(e) => setLocalDraft((p) => ({ ...p, [key]: e.target.value }))}
                rows={4}
                style={{
                  width: "100%", fontSize: 13, padding: "8px 10px",
                  border: "1px solid #d1d5db", borderRadius: 6,
                  fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
                }}
              />
            ) : (
              <input
                value={localDraft[key] || ""}
                onChange={(e) => setLocalDraft((p) => ({ ...p, [key]: e.target.value }))}
                style={{
                  width: "100%", fontSize: 13, padding: "8px 10px",
                  border: "1px solid #d1d5db", borderRadius: 6,
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            )
          ) : (
            <div style={{ fontSize: 13, color: draft[key] ? "#111827" : "#9ca3af", lineHeight: 1.6 }}>
              {draft[key] || "Not provided"}
            </div>
          )}
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            flex: 1, padding: "11px 0", fontSize: 14, fontWeight: 700,
            background: submitting ? "#9ca3af" : "#1a56db", color: "#fff",
            border: "none", borderRadius: 8, cursor: submitting ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {submitting ? "Submitting..." : "Submit Complaint"}
        </button>
        <button
          onClick={onEdit}
          style={{
            padding: "11px 18px", fontSize: 13, fontWeight: 600,
            background: "#f3f4f6", color: "#374151",
            border: "none", borderRadius: 8, cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Continue Chat
        </button>
      </div>
    </div>
  );
}
