import { useEffect, useState } from "react";
import api from "../api/api";
import ComplaintSubmissionSuccess from "../components/ComplaintSubmissionSuccess";
import IntakeChat from "../components/IntakeChat";
import { ArrowRightIcon, CheckIcon } from "../components/PublicIcons";
import StructuredDraftPreview from "../components/StructuredDraftPreview";
import { useCitizenI18n } from "../i18n";
import { rememberTrackedComplaint } from "../utils/portalState";

export default function GuidedReportPage({ language, onTrack }) {
  const { t } = useCitizenI18n();
  const [sessionToken, setSessionToken] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState({});
  const [isComplete, setIsComplete] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [typing, setTyping] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [submissionWarning, setSubmissionWarning] = useState("");
  const [error, setError] = useState("");
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const startSession = async (selectedLanguage) => {
    setStarting(true);
    setError("");
    setMessages([]);
    setDraft({});
    setIsComplete(false);
    setShowPreview(false);
    setSubmitted(null);
    setAttachmentFile(null);
    setAttachmentError("");
    setSubmissionWarning("");
    setShowLocationPicker(false);

    try {
      const res = await api.post("/intake/start", { language: selectedLanguage });
      const { session_token, greeting } = res.data.data;
      setSessionToken(session_token);
      setMessages([{ role: "assistant", content: greeting }]);
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || t("guided.error.start"));
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    void startSession(language || "en");
  }, [language]);

  const handleSend = async (text, locationData = null) => {
    if (!sessionToken || typing) {
      return;
    }

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
      setMessages((prev) => [...prev, { role: "assistant", content: t("guided.error.reply") }]);
      setError(err?.response?.data?.message || err?.response?.data?.error || "");
    } finally {
      setTyping(false);
    }
  };

  const handleLocationPicked = (locationData) => {
    const displayText = locationData.address_text || `${locationData.latitude.toFixed(5)}, ${locationData.longitude.toFixed(5)}`;
    void handleSend(`My location: ${displayText}`, locationData);
  };

  const handleTrackStatus = () => {
    if (!submitted?.id) {
      return;
    }

    rememberTrackedComplaint(submitted.id);
    onTrack?.();
  };

  const handleSubmit = async (finalDraft) => {
    setSubmitting(true);
    setError("");
    setAttachmentError("");
    setSubmissionWarning("");

    try {
      const res = await api.post(`/intake/${sessionToken}/submit`, finalDraft);
      const complaint = res.data.data;
      let warning = "";

      if (attachmentFile) {
        try {
          const uploadData = new FormData();
          uploadData.append("file", attachmentFile);
          await api.post(`/citizen-complaints/${complaint.id}/attachments`, uploadData);
        } catch {
          warning = t("guided.warning.attachment");
          setAttachmentError(warning);
        }
      }

      rememberTrackedComplaint(complaint.id);
      setSubmissionWarning(warning);
      setSubmitted(complaint);
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || t("guided.error.submit"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="container guided-report-container guided-report-container-success">
        <ComplaintSubmissionSuccess
          complaint={submitted}
          title={t("guided.successTitle")}
          description={t("guided.successDescription")}
          warning={submissionWarning}
          onTrack={handleTrackStatus}
          onReset={() => startSession(language)}
        />
      </div>
    );
  }

  return (
    <div className="container guided-report-container">
      <div className="guided-report-header">
        <div className="guided-report-header-copy">
          <div>
            <h2 className="guided-report-title">{t("guided.title")}</h2>
            <p className="guided-report-subtitle">{t("guided.subtitle")}</p>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-error guided-report-error">{error}</div> : null}

      <div className={`guided-chat-shell ${showLocationPicker ? "has-location-picker" : ""}`}>
        {starting ? (
          <div className="guided-chat-loading">{t("guided.starting")}</div>
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

      {!showPreview && sessionToken ? (
        <div className="guided-progress-strip">
          {[
            { field: t("guided.progress.department"), key: "department_id" },
            { field: t("guided.progress.type"), key: "issue_type_id" },
            { field: t("guided.progress.description"), key: "description" },
            { field: t("guided.progress.location"), key: "address_text" },
          ].map((item) => {
            const filled = Boolean(draft[item.key]);
            return (
              <div key={item.key} className={`guided-progress-chip ${filled ? "is-complete" : ""}`}>
                <span className="guided-progress-dot">
                  {filled ? <CheckIcon size={11} /> : null}
                </span>
                <span>{item.field}</span>
              </div>
            );
          })}
          {isComplete ? (
            <button onClick={() => setShowPreview(true)} className="guided-review-btn">
              <ArrowRightIcon size={16} />
              {t("guided.review")}
            </button>
          ) : null}
        </div>
      ) : null}

      {showPreview && Object.keys(draft).length > 0 ? (
        <StructuredDraftPreview
          draft={draft}
          onSubmit={handleSubmit}
          onEdit={() => setShowPreview(false)}
          submitting={submitting}
          attachmentFile={attachmentFile}
          onAttachmentChange={(nextFile) => {
            setAttachmentFile(nextFile);
            setAttachmentError("");
          }}
          attachmentError={attachmentError}
        />
      ) : null}
    </div>
  );
}
