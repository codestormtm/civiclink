import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../api/api";
import {
  ArrowRightIcon,
  AssistantIcon,
  CrosshairIcon,
  LocationIcon,
  TrashIcon,
} from "../components/PublicIcons";
import ComplaintSubmissionSuccess from "../components/ComplaintSubmissionSuccess";
import { useCitizenI18n } from "../i18n";
import { rememberTrackedComplaint } from "../utils/portalState";

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#1a56db;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function MapClickHandler({ onPick }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

function RecenterMap({ lat, lng }) {
  const map = useMap();

  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 15);
    }
  }, [lat, lng, map]);

  return null;
}

const SRI_LANKA = [7.8731, 80.7718];
const EMPTY_FORM = {
  department_id: "",
  issue_type_id: "",
  title: "",
  description: "",
};
const EMPTY_LOCATION = {
  latitude: null,
  longitude: null,
  address_text: "",
  location_source: "",
};

export default function CitizenComplaintForm({ onOpenAi, onTrack }) {
  const { t } = useCitizenI18n();
  const [departments, setDepartments] = useState([]);
  const [types, setTypes] = useState([]);
  const [file, setFile] = useState(null);
  const [submittedComplaint, setSubmittedComplaint] = useState(null);
  const [submissionWarning, setSubmissionWarning] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [location, setLocation] = useState(EMPTY_LOCATION);

  useEffect(() => {
    api.get("/citizen-complaints/departments")
      .then((res) => setDepartments(res.data))
      .catch(() => setError(t("complaint.error.departments")));
  }, [t]);

  const fetchTypes = (departmentId) => {
    api.get(`/citizen-complaints/departments/${departmentId}/types`)
      .then((res) => setTypes(res.data))
      .catch(() => setError(t("complaint.error.types")));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setTypes([]);
    setFile(null);
    setLocation(EMPTY_LOCATION);
    setShowMap(false);
    setSubmissionWarning("");
    setSubmittedComplaint(null);
    setError("");
  };

  const handleDepartmentChange = (event) => {
    const departmentId = event.target.value;
    setForm((prev) => ({ ...prev, department_id: departmentId, issue_type_id: "" }));
    if (departmentId) {
      fetchTypes(departmentId);
    } else {
      setTypes([]);
    }
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { "Accept-Language": "en" } },
      );
      const data = await res.json();
      return data.display_name || null;
    } catch {
      return null;
    }
  };

  const handleGPS = () => {
    if (!navigator.geolocation) {
      window.alert(t("complaint.error.geolocation"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const address = await reverseGeocode(lat, lng);

        setLocation({
          latitude: lat,
          longitude: lng,
          address_text: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          location_source: "gps",
        });
        setShowMap(true);
      },
      () => window.alert(t("complaint.error.location")),
    );
  };

  const handleMapClick = async (lat, lng) => {
    const address = await reverseGeocode(lat, lng);
    setLocation({
      latitude: lat,
      longitude: lng,
      address_text: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      location_source: "pin",
    });
  };

  const clearLocation = () => {
    setLocation(EMPTY_LOCATION);
  };

  const handleTrackStatus = () => {
    if (!submittedComplaint?.id) {
      return;
    }

    rememberTrackedComplaint(submittedComplaint.id);
    onTrack?.();
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError("");
      setSubmissionWarning("");

      const payload = {
        ...form,
        ...(location.latitude != null && {
          latitude: location.latitude,
          longitude: location.longitude,
          address_text: location.address_text || null,
          location_source: location.location_source || null,
        }),
      };

      const complaintRes = await api.post("/citizen-complaints", payload);
      const complaint = complaintRes.data.data;
      let warning = "";

      if (file) {
        try {
          const uploadData = new FormData();
          uploadData.append("file", file);
          await api.post(`/citizen-complaints/${complaint.id}/attachments`, uploadData);
        } catch {
          warning = t("complaint.warning.attachment");
        }
      }

      rememberTrackedComplaint(complaint.id);
      setSubmittedComplaint(complaint);
      setSubmissionWarning(warning);
      setForm(EMPTY_FORM);
      setTypes([]);
      setFile(null);
      clearLocation();
      setShowMap(false);
    } catch (err) {
      const errorData = err?.response?.data?.error;
      setError(
        Array.isArray(errorData)
          ? errorData.map((item) => item.message).join(", ")
          : errorData || err?.response?.data?.message || t("complaint.error.submit"),
      );
    } finally {
      setLoading(false);
    }
  };

  const hasLocation = location.latitude != null && location.longitude != null;

  return (
    <div className="container">
      <div className="page-heading">
        <h2>{t("complaint.heading")}</h2>
        <p>{t("complaint.subtitle")}</p>
      </div>

      <div className="card ai-launch-card">
        <div>
          <h3 style={{ marginBottom: 6 }}>{t("complaint.aiTitle")}</h3>
          <p style={{ marginBottom: 0 }}>{t("complaint.aiCopy")}</p>
        </div>
        <button type="button" className="ai-launch-bubble" onClick={onOpenAi}>
          <span className="ai-launch-bubble-icon">
            <AssistantIcon size={16} />
          </span>
          <span className="ai-launch-bubble-text">{t("complaint.aiButton")}</span>
        </button>
      </div>

      {submittedComplaint ? (
        <ComplaintSubmissionSuccess
          complaint={submittedComplaint}
          title={t("success.title")}
          description={t("success.description")}
          warning={submissionWarning}
          onTrack={handleTrackStatus}
          onReset={resetForm}
        />
      ) : null}

      <div className="card">
        {error ? <div className="alert alert-error">{error}</div> : null}

        <div className="form-grid">
          <div className="form-group">
            <label>{t("complaint.department")}</label>
            <select value={form.department_id} onChange={handleDepartmentChange}>
              <option value="">{t("complaint.selectDepartment")}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{t("complaint.type")}</label>
            <select
              value={form.issue_type_id}
              onChange={(event) => setForm({ ...form, issue_type_id: event.target.value })}
              disabled={types.length === 0}
            >
              <option value="">{t("complaint.selectType")}</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{t("complaint.title")}</label>
            <input
              type="text"
              placeholder={t("complaint.titlePlaceholder")}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{t("complaint.description")}</label>
            <textarea
              placeholder={t("complaint.descriptionPlaceholder")}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>
              {t("complaint.location")} <span className="citizen-optional-label">({t("common.optional")})</span>
            </label>

            <div className="citizen-location-actions">
              <button type="button" onClick={handleGPS} className="citizen-action-btn is-primary">
                <CrosshairIcon size={16} />
                {t("complaint.useLocation")}
              </button>
              <button
                type="button"
                onClick={() => setShowMap((value) => !value)}
                className={`citizen-action-btn ${showMap ? "is-soft-active" : "is-soft"}`}
              >
                <LocationIcon size={16} />
                {showMap ? t("complaint.hideMap") : t("complaint.pinMap")}
              </button>
              {hasLocation ? (
                <button type="button" onClick={clearLocation} className="citizen-action-btn is-danger">
                  <TrashIcon size={16} />
                  {t("complaint.clear")}
                </button>
              ) : null}
            </div>

            {hasLocation ? (
              <div className="citizen-location-summary">
                <span className="citizen-location-summary-label">{t("complaint.selected")}</span>
                <span className="citizen-location-summary-copy">
                  {location.address_text || `${location.latitude?.toFixed(5)}, ${location.longitude?.toFixed(5)}`}
                  <span className="citizen-location-summary-meta">
                    ({location.latitude?.toFixed(5)}, {location.longitude?.toFixed(5)})
                  </span>
                </span>
              </div>
            ) : null}

            {showMap ? (
              <div className="citizen-map-card">
                <div className="citizen-map-card-hint">{t("complaint.mapHint")}</div>
                <MapContainer
                  center={hasLocation ? [location.latitude, location.longitude] : SRI_LANKA}
                  zoom={hasLocation ? 15 : 8}
                  className="citizen-map-frame"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="OpenStreetMap contributors"
                  />
                  <MapClickHandler onPick={handleMapClick} />
                  {hasLocation ? (
                    <>
                      <RecenterMap lat={location.latitude} lng={location.longitude} />
                      <Marker position={[location.latitude, location.longitude]} icon={pinIcon} />
                    </>
                  ) : null}
                </MapContainer>
              </div>
            ) : null}
          </div>

          <div className="form-group">
            <label>{t("complaint.supporting")} <span className="citizen-optional-label">({t("common.optional")})</span></label>
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </div>

          <button className="citizen-action-btn is-maroon citizen-action-btn-full" onClick={handleSubmit} disabled={loading}>
            <ArrowRightIcon size={16} />
            {loading ? t("complaint.submitting") : t("complaint.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
