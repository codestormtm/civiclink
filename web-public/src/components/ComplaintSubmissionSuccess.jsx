import { useState } from "react";

export default function ComplaintSubmissionSuccess({
  complaint,
  title = "Complaint submitted",
  description,
  warning = "",
  onTrack,
  onReset,
  resetLabel = "Report Another Complaint",
}) {
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
    <div
      className="card"
      style={{
        textAlign: "center",
        padding: "32px 28px",
        background:
          "radial-gradient(circle at top right, rgba(246, 190, 50, 0.18), transparent 24%), rgba(255,255,255,0.96)",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          margin: "0 auto 16px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(12, 91, 85, 0.12)",
          color: "var(--sl-green-900)",
          fontSize: 30,
          fontWeight: 800,
        }}
      >
        {"\u2713"}
      </div>
      <h2 style={{ marginBottom: 8 }}>{title}</h2>
      <p style={{ marginBottom: 20 }}>
        {description || "Your complaint has been recorded and sent to the relevant department."}
      </p>

      <div
        style={{
          border: "1px solid var(--sl-line)",
          borderRadius: 14,
          padding: "18px 16px",
          background: "#fff9ef",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 800,
            color: "var(--sl-muted-500)",
            marginBottom: 8,
          }}
        >
          Tracking ID
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 18,
            fontWeight: 700,
            color: "var(--sl-ink-900)",
            wordBreak: "break-all",
            marginBottom: 10,
          }}
        >
          {complaint.id}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn-outline"
            style={{ width: "auto" }}
            onClick={handleCopy}
          >
            {copied ? "Copied" : "Copy ID"}
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ width: "auto", minWidth: 150 }}
            onClick={onTrack}
          >
            Track Status
          </button>
        </div>
      </div>

      {complaint.title && (
        <div
          style={{
            textAlign: "left",
            borderRadius: 12,
            border: "1px solid rgba(138, 21, 56, 0.08)",
            background: "rgba(255, 250, 241, 0.85)",
            padding: "14px 16px",
            marginBottom: warning ? 12 : 20,
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 800,
              color: "var(--sl-muted-500)",
              marginBottom: 6,
            }}
          >
            Submitted as
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--sl-ink-900)" }}>
            {complaint.title}
          </div>
        </div>
      )}

      {warning && (
        <div className="alert alert-error" style={{ textAlign: "left", marginBottom: 20 }}>
          {warning}
        </div>
      )}

      <button type="button" onClick={onReset} className="btn-primary">
        {resetLabel}
      </button>
    </div>
  );
}
