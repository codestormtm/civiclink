import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import LocationPickerCard from "../components/LocationPickerCard";
import {
  ArrowRightIcon,
  CheckIcon,
  ImageIcon,
  TrashIcon,
} from "../components/PublicIcons";
import ComplaintSubmissionSuccess from "../components/ComplaintSubmissionSuccess";
import { useCitizenI18n } from "../i18n";
import { rememberTrackedComplaint, rememberTrackedComplaintDetail } from "../utils/portalState";

const STEPS = ["welcome", "describe", "emergency", "photo", "location", "review"];

function WizardSteps({ currentStep }) {
  const currentIndex = STEPS.indexOf(currentStep);

  return (
    <div className="citizen-wizard-steps" aria-label="Report progress">
      {STEPS.map((step, index) => (
        <div
          key={step}
          className={`citizen-wizard-step ${index <= currentIndex ? "is-active" : ""}`}
        >
          <span>{index < currentIndex ? <CheckIcon size={12} /> : index + 1}</span>
        </div>
      ))}
    </div>
  );
}

function getDraftValue(draft, key) {
  return draft?.[key] || "";
}

export default function CitizenComplaintForm({ onOpenAi, onTrack }) {
  const { t } = useCitizenI18n();
  const [step, setStep] = useState("welcome");
  const [sessionToken, setSessionToken] = useState("");
  const [description, setDescription] = useState("");
  const [emergencyAck, setEmergencyAck] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [location, setLocation] = useState(null);
  const [draft, setDraft] = useState({});
  const [submittedComplaint, setSubmittedComplaint] = useState(null);
  const [submissionWarning, setSubmissionWarning] = useState("");
  const [loading, setLoading] = useState(false);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState("");

  const currentStepIndex = STEPS.indexOf(step);
  const canGoBack = currentStepIndex > 0 && !loading && !routing;

  const reviewReady = useMemo(() => (
    Boolean(draft.department_id && draft.issue_type_id && draft.title && draft.description)
  ), [draft]);

  useEffect(() => {
    let active = true;

    async function startIntake() {
      setLoading(true);
      setError("");

      try {
        const res = await api.post("/intake/start", { language: document.documentElement.lang || "en" });
        if (active) {
          setSessionToken(res.data?.data?.session_token || "");
        }
      } catch (err) {
        if (active) {
          setError(err?.response?.data?.message || err?.response?.data?.error || t("wizard.error.unavailable"));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void startIntake();

    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    let objectUrl = "";

    if (photoFile) {
      objectUrl = URL.createObjectURL(photoFile);
      setPhotoPreview(objectUrl);
    } else {
      setPhotoPreview("");
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photoFile]);

  const resetWizard = () => {
    setStep("welcome");
    setDescription("");
    setEmergencyAck(false);
    setPhotoFile(null);
    setPhotoPreview("");
    setLocation(null);
    setDraft({});
    setSubmittedComplaint(null);
    setSubmissionWarning("");
    setError("");
  };

  const sendToIntake = async (message, locationData = null) => {
    if (!sessionToken) {
      throw new Error(t("wizard.error.unavailable"));
    }

    const body = { message };
    if (locationData) {
      body.latitude = locationData.latitude;
      body.longitude = locationData.longitude;
      body.address_text = locationData.address_text;
    }

    const res = await api.post(`/intake/${sessionToken}/message`, body);
    const nextDraft = res.data?.data?.draft || {};
    setDraft(nextDraft);
    return nextDraft;
  };

  const handleDescriptionContinue = async () => {
    if (description.trim().length < 10) {
      setError(t("wizard.error.description"));
      return;
    }

    setRouting(true);
    setError("");

    try {
      await sendToIntake(description.trim());
      setStep("emergency");
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || t("wizard.error.route"));
    } finally {
      setRouting(false);
    }
  };

  const handleLocationPicked = async (nextLocation) => {
    setLocation(nextLocation);
    setRouting(true);
    setError("");

    try {
      await sendToIntake(
        `Complaint location: ${nextLocation.address_text || `${nextLocation.latitude}, ${nextLocation.longitude}`}`,
        nextLocation,
      );
      setStep("review");
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || t("wizard.error.route"));
    } finally {
      setRouting(false);
    }
  };

  const submitComplaint = async () => {
    if (!reviewReady) {
      setError(t("wizard.error.incomplete"));
      return;
    }

    setLoading(true);
    setError("");
    setSubmissionWarning("");

    try {
      const finalDraft = {
        ...draft,
        title: getDraftValue(draft, "title"),
        description: getDraftValue(draft, "description") || description.trim(),
        address_text: location?.address_text || draft.address_text || null,
        latitude: location?.latitude ?? draft.latitude ?? null,
        longitude: location?.longitude ?? draft.longitude ?? null,
      };

      const res = await api.post(`/intake/${sessionToken}/submit`, finalDraft);
      const complaint = res.data?.data;
      let warning = "";

      if (photoFile && complaint?.id) {
        try {
          const uploadData = new FormData();
          uploadData.append("file", photoFile);
          await api.post(`/citizen-complaints/${complaint.id}/attachments`, uploadData);
        } catch {
          warning = t("wizard.warning.photo");
        }
      }

      rememberTrackedComplaintDetail(complaint);
      setSubmittedComplaint(complaint);
      setSubmissionWarning(warning);
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || t("wizard.error.submit"));
    } finally {
      setLoading(false);
    }
  };

  const handleTrackStatus = () => {
    if (submittedComplaint?.id) {
      rememberTrackedComplaint(submittedComplaint.id);
      onTrack?.();
    }
  };

  if (submittedComplaint) {
    return (
      <div className="container citizen-wizard-container">
        <ComplaintSubmissionSuccess
          complaint={submittedComplaint}
          title={t("wizard.success.title")}
          description={t("wizard.success.copy")}
          warning={submissionWarning}
          onTrack={handleTrackStatus}
          onReset={resetWizard}
        />
      </div>
    );
  }

  return (
    <div className="container citizen-wizard-container">
      <section className="citizen-wizard-shell">
        {onOpenAi ? (
          <button
            type="button"
            className="citizen-ai-fab"
            onClick={onOpenAi}
            aria-label={t("wizard.aiShortcut")}
          >
            <span className="citizen-ai-fab-icon">AI</span>
            <span>{t("wizard.aiShortcut")}</span>
          </button>
        ) : null}

        <div className="citizen-wizard-header">
          <div>
            <div className="citizen-wizard-kicker">{t("wizard.kicker")}</div>
            <h2 className="citizen-wizard-title">{t("wizard.title")}</h2>
          </div>
          <WizardSteps currentStep={step} />
        </div>

        {error ? <div className="alert alert-error citizen-wizard-alert">{error}</div> : null}

        {loading && !sessionToken ? (
          <div className="citizen-wizard-panel">
            <p className="citizen-wizard-copy">{t("wizard.loading")}</p>
          </div>
        ) : null}

        {!loading && step === "welcome" ? (
          <div className="citizen-wizard-panel">
            <div className="citizen-wizard-icon">C</div>
            <h3>{t("wizard.welcome.title")}</h3>
            <p className="citizen-wizard-copy">{t("wizard.welcome.copy")}</p>
            <button
              type="button"
              className="citizen-action-btn is-maroon citizen-action-btn-full"
              onClick={() => setStep("describe")}
              disabled={!sessionToken}
            >
              <ArrowRightIcon size={16} />
              {t("wizard.start")}
            </button>
          </div>
        ) : null}

        {step === "describe" ? (
          <div className="citizen-wizard-panel">
            <h3>{t("wizard.describe.title")}</h3>
            <p className="citizen-wizard-copy">{t("wizard.describe.copy")}</p>
            <textarea
              className="citizen-wizard-textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={7}
              placeholder={t("wizard.describe.placeholder")}
            />
            <button
              type="button"
              className="citizen-action-btn is-maroon citizen-action-btn-full"
              onClick={handleDescriptionContinue}
              disabled={routing}
            >
              <ArrowRightIcon size={16} />
              {routing ? t("wizard.routing") : t("wizard.continue")}
            </button>
          </div>
        ) : null}

        {step === "emergency" ? (
          <div className="citizen-wizard-panel citizen-emergency-panel">
            <h3>{t("wizard.emergency.title")}</h3>
            <p className="citizen-wizard-copy">{t("wizard.emergency.copy")}</p>
            <label className="citizen-wizard-check">
              <input
                type="checkbox"
                checked={emergencyAck}
                onChange={(event) => setEmergencyAck(event.target.checked)}
              />
              <span>{t("wizard.emergency.ack")}</span>
            </label>
            <button
              type="button"
              className="citizen-action-btn is-maroon citizen-action-btn-full"
              onClick={() => setStep("photo")}
              disabled={!emergencyAck}
            >
              <ArrowRightIcon size={16} />
              {t("wizard.continue")}
            </button>
          </div>
        ) : null}

        {step === "photo" ? (
          <div className="citizen-wizard-panel">
            <h3>{t("wizard.photo.title")}</h3>
            <p className="citizen-wizard-copy">{t("wizard.photo.copy")}</p>
            <label className="citizen-wizard-photo-picker">
              <ImageIcon size={18} />
              <span>{photoFile ? t("wizard.photo.replace") : t("wizard.photo.choose")}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
              />
            </label>
            {photoPreview ? (
              <div className="citizen-wizard-photo-preview">
                <img src={photoPreview} alt={t("wizard.photo.previewAlt")} />
                <button type="button" className="citizen-action-btn is-danger" onClick={() => setPhotoFile(null)}>
                  <TrashIcon size={16} />
                  {t("complaint.clear")}
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className="citizen-action-btn is-maroon citizen-action-btn-full"
              onClick={() => setStep("location")}
            >
              <ArrowRightIcon size={16} />
              {photoFile ? t("wizard.continue") : t("wizard.photo.skip")}
            </button>
          </div>
        ) : null}

        {step === "location" ? (
          <div className="citizen-wizard-panel citizen-wizard-location-panel">
            <h3>{t("wizard.location.title")}</h3>
            <p className="citizen-wizard-copy">{t("wizard.location.copy")}</p>
            {routing ? <div className="citizen-wizard-routing">{t("wizard.routing")}</div> : null}
            <LocationPickerCard onLocationPicked={handleLocationPicked} />
          </div>
        ) : null}

        {step === "review" ? (
          <div className="citizen-wizard-panel">
            <h3>{t("wizard.review.title")}</h3>
            <p className="citizen-wizard-copy">{t("wizard.review.copy")}</p>

            <div className="citizen-wizard-review-list">
              <div>
                <span>{t("preview.titleField")}</span>
                <strong>{getDraftValue(draft, "title") || t("common.notProvided")}</strong>
              </div>
              <div>
                <span>{t("preview.descriptionField")}</span>
                <strong>{getDraftValue(draft, "description") || description}</strong>
              </div>
              <div>
                <span>{t("preview.locationField")}</span>
                <strong>{location?.address_text || getDraftValue(draft, "address_text") || t("common.notProvided")}</strong>
              </div>
              <div>
                <span>{t("wizard.review.photo")}</span>
                <strong>{photoFile?.name || t("wizard.review.noPhoto")}</strong>
              </div>
            </div>

            {!reviewReady ? (
              <div className="alert alert-error citizen-wizard-alert">
                {t("wizard.review.notReady")}
              </div>
            ) : null}

            <button
              type="button"
              className="citizen-action-btn is-maroon citizen-action-btn-full"
              onClick={submitComplaint}
              disabled={loading || !reviewReady}
            >
              <ArrowRightIcon size={16} />
              {loading ? t("complaint.submitting") : t("complaint.submit")}
            </button>
          </div>
        ) : null}

        {canGoBack ? (
          <button type="button" className="citizen-wizard-back" onClick={() => setStep(STEPS[currentStepIndex - 1])}>
            {t("common.cancel")}
          </button>
        ) : null}
      </section>
    </div>
  );
}
