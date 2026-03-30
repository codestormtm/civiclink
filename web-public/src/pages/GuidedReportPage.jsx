import { useState, useEffect } from "react";
import api from "../api/api";
import IntakeChat from "../components/IntakeChat";
import LanguageSelector from "../components/LanguageSelector";
import StructuredDraftPreview from "../components/StructuredDraftPreview";

export default function GuidedReportPage() {
  const [language, setLanguage] = useState("en");
  const [sessionToken, setSessionToken] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState({});
  const [isComplete, setIsComplete] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [typing, setTyping] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState("");
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const startSession = async (lang) => {
    setStarting(true);
    setError("");
    setMessages([]);
    setDraft({});
    setIsComplete(false);
    setShowPreview(false);
    setSubmitted(null);
    setShowLocationPicker(false);

    try {
      const res = await api.post("/intake/start", { language: lang });
      const { session_token, greeting } = res.data.data;
      setSessionToken(session_token);
      setMessages([{ role: "assistant", content: greeting }]);
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || "Failed to start session. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    startSession("en");
  }, []);

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    startSession(lang);
  };

  const handleSend = async (text, locationData = null) => {
    if (!sessionToken || typing) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setTyping(true);
    setError("");
    setShowLocationPicker(false);

    try {
      const body = { message: text };
      if (locationData) {
        body.latitude = locationData.latitude;
        body.longitude = locationData.longitude;
        body.address_text = locationData.address_text;
      }

      const res = await api.post(`/intake/${sessionToken}/message`, body);
      const { reply, draft: newDraft, is_complete, needs_location } = res.data.data;

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setDraft(newDraft);

      if (is_complete) {
        setIsComplete(true);
        setShowPreview(true);
      } else if (needs_location) {
        setShowLocationPicker(true);
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      }]);
      setError(err?.response?.data?.message || err?.response?.data?.error || "");
    } finally {
      setTyping(false);
    }
  };

  const handleLocationPicked = (locationData) => {
    const displayText = locationData.address_text || `${locationData.latitude.toFixed(5)}, ${locationData.longitude.toFixed(5)}`;
    handleSend(`\uD83D\uDCCD My location: ${displayText}`, locationData);
  };

  const handleSubmit = async (finalDraft) => {
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post(`/intake/${sessionToken}/submit`, finalDraft);
      setSubmitted(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="card" style={{ textAlign: "center", padding: "40px 32px", background: "rgba(255,255,255,0.94)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{"\u2705"}</div>
          <h2 style={{ color: "var(--sl-green-900)", margin: "0 0 8px" }}>Complaint Submitted!</h2>
          <p style={{ color: "var(--sl-muted-500)", fontSize: 14, margin: "0 0 4px" }}>
            Your complaint has been received and will be reviewed by the relevant department.
          </p>
          <p style={{ color: "var(--sl-muted-500)", fontSize: 13, marginBottom: 24 }}>
            Reference ID: <strong style={{ color: "var(--sl-ink-900)", fontFamily: "monospace" }}>{submitted.id}</strong>
          </p>
          <div style={{ background: "#fff7e7", border: "1px solid var(--sl-line)", borderRadius: 8, padding: "14px 16px", textAlign: "left", marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: "var(--sl-muted-500)", marginBottom: 6, textTransform: "uppercase", fontWeight: 700 }}>Submitted as</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--sl-ink-900)" }}>{submitted.title}</div>
          </div>
          <button
            onClick={() => startSession(language)}
            style={{
              padding: "10px 24px", fontSize: 13, fontWeight: 600,
              background: "var(--sl-maroon-900)", color: "var(--sl-white)", border: "none",
              borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Report Another Complaint
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: "var(--sl-ink-900)" }}>AI Complaint Assistant</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--sl-muted-500)" }}>
              Tell me what's wrong - I'll handle the rest.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LanguageSelector
              value={language}
              onChange={handleLanguageChange}
              disabled={starting || typing}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>
      )}

      <div style={{
        background: "rgba(255,255,255,0.94)",
        borderRadius: 12,
        border: "1px solid var(--sl-line)",
        boxShadow: "var(--sl-shadow)",
        overflow: "hidden",
        height: showLocationPicker ? 620 : 440,
        display: "flex",
        flexDirection: "column",
      }}>
        {starting ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--sl-muted-500)", fontSize: 14 }}>
            Starting AI assistant...
          </div>
        ) : (
          <IntakeChat
            messages={messages}
            onSend={handleSend}
            typing={typing}
            inputDisabled={typing || !sessionToken || showPreview || showLocationPicker}
            locationPicker={showLocationPicker}
            onLocationPicked={handleLocationPicked}
          />
        )}
      </div>

      {!showPreview && sessionToken && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
          {["department", "complaint type", "description", "location"].map((field, i) => {
            const keys = ["department_id", "issue_type_id", "description", "address_text"];
            const filled = !!draft[keys[i]];
            return (
              <div key={field} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: filled ? "var(--sl-green-900)" : "var(--sl-muted-500)" }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: filled ? "var(--sl-green-900)" : "#d6c8b6",
                }} />
                {field}
                {i < 3 && <span style={{ color: "#d6c8b6", marginLeft: 4 }}>{"\u2014"}</span>}
              </div>
            );
          })}
          {isComplete && (
            <button
              onClick={() => setShowPreview(true)}
              style={{
                marginLeft: "auto", padding: "4px 12px", fontSize: 12, fontWeight: 600,
                background: "var(--sl-green-900)", color: "var(--sl-white)", border: "none",
                borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {"Review & Submit \u2192"}
            </button>
          )}
        </div>
      )}

      {showPreview && Object.keys(draft).length > 0 && (
        <StructuredDraftPreview
          draft={draft}
          onSubmit={handleSubmit}
          onEdit={() => setShowPreview(false)}
          submitting={submitting}
        />
      )}
    </div>
  );
}
