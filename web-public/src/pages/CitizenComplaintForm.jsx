import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import api from "../api/api";

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#1a56db;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function MapClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.flyTo([lat, lng], 15);
  }, [lat, lng, map]);
  return null;
}

const SRI_LANKA = [7.8731, 80.7718];

export default function CitizenComplaintForm() {
  const [departments, setDepartments] = useState([]);
  const [types, setTypes] = useState([]);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const [form, setForm] = useState({
    department_id: "",
    issue_type_id: "",
    title: "",
    description: "",
  });

  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    address_text: "",
    location_source: "",
  });

  useEffect(() => {
    api.get("/citizen-complaints/departments")
      .then((res) => setDepartments(res.data))
      .catch(() => setError("Failed to load departments"));
  }, []);

  const fetchTypes = (departmentId) => {
    api.get(`/citizen-complaints/departments/${departmentId}/types`)
      .then((res) => setTypes(res.data))
      .catch(() => setError("Failed to load complaint types"));
  };

  const handleDepartmentChange = (e) => {
    const departmentId = e.target.value;
    setForm((prev) => ({ ...prev, department_id: departmentId, issue_type_id: "" }));
    if (departmentId) fetchTypes(departmentId);
    else setTypes([]);
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      return data.display_name || null;
    } catch {
      return null;
    }
  };

  const handleGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const address = await reverseGeocode(lat, lng);
        setLocation({
          latitude: lat,
          longitude: lng,
          address_text: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          location_source: "gps",
        });
        setShowMap(true);
      },
      () => alert("Unable to get your location. Please pin it on the map.")
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
    setLocation({ latitude: null, longitude: null, address_text: "", location_source: "" });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setMessage("");
      setError("");

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

      if (file) {
        const uploadData = new FormData();
        uploadData.append("file", file);
        await api.post(`/citizen-complaints/${complaint.id}/attachments`, uploadData);
      }

      setMessage(`Complaint submitted successfully. Reference ID: ${complaint.id}`);
      setForm({ department_id: "", issue_type_id: "", title: "", description: "" });
      setTypes([]);
      setFile(null);
      clearLocation();
      setShowMap(false);
    } catch (err) {
      const errorData = err?.response?.data?.error;
      setError(
        Array.isArray(errorData)
          ? errorData.map((e) => e.message).join(", ")
          : errorData || err?.response?.data?.message || "Failed to submit complaint"
      );
    } finally {
      setLoading(false);
    }
  };

  const hasLocation = location.latitude != null && location.longitude != null;

  return (
    <div className="container">
      <div className="page-heading">
        <h2>Submit a Complaint</h2>
        <p>Report a public issue to the relevant government department.</p>
      </div>

      <div className="card">
        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-grid">
          <div className="form-group">
            <label>Department</label>
            <select value={form.department_id} onChange={handleDepartmentChange}>
              <option value="">Select Department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Complaint Type</label>
            <select
              value={form.issue_type_id}
              onChange={(e) => setForm({ ...form, issue_type_id: e.target.value })}
              disabled={types.length === 0}
            >
              <option value="">Select Complaint Type</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              placeholder="Brief title of your complaint"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              placeholder="Describe the complaint in detail"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
            />
          </div>

          {/* Location Section */}
          <div className="form-group">
            <label>Location <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 400 }}>(optional)</span></label>

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button
                type="button"
                onClick={handleGPS}
                style={{
                  padding: "8px 14px", fontSize: 13, fontWeight: 600,
                  background: "#1a56db", color: "#fff", border: "none",
                  borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                📍 Use My Location
              </button>
              <button
                type="button"
                onClick={() => setShowMap((v) => !v)}
                style={{
                  padding: "8px 14px", fontSize: 13, fontWeight: 600,
                  background: showMap ? "#e5e7eb" : "#f3f4f6", color: "#374151",
                  border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                🗺 {showMap ? "Hide Map" : "Pin on Map"}
              </button>
              {hasLocation && (
                <button
                  type="button"
                  onClick={clearLocation}
                  style={{
                    padding: "8px 14px", fontSize: 13, fontWeight: 600,
                    background: "#fff", color: "#ef4444",
                    border: "1px solid #fca5a5", borderRadius: 8, cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {hasLocation && (
              <div style={{
                fontSize: 13, color: "#374151", background: "#f0fdf4",
                border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 12px",
                marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ color: "#16a34a" }}>✓</span>
                <span>
                  {location.address_text || `${location.latitude?.toFixed(5)}, ${location.longitude?.toFixed(5)}`}
                  <span style={{ color: "#9ca3af", marginLeft: 8 }}>
                    ({location.latitude?.toFixed(5)}, {location.longitude?.toFixed(5)})
                  </span>
                </span>
              </div>
            )}

            {showMap && (
              <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 12, color: "#6b7280", padding: "6px 10px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  Click anywhere on the map to set the complaint location
                </div>
                <MapContainer
                  center={hasLocation ? [location.latitude, location.longitude] : SRI_LANKA}
                  zoom={hasLocation ? 15 : 8}
                  style={{ height: 280, width: "100%" }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="© OpenStreetMap contributors"
                  />
                  <MapClickHandler onPick={handleMapClick} />
                  {hasLocation && (
                    <>
                      <RecenterMap lat={location.latitude} lng={location.longitude} />
                      <Marker position={[location.latitude, location.longitude]} icon={pinIcon} />
                    </>
                  )}
                </MapContainer>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Supporting Document / Photo (optional)</label>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          </div>

          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Submitting..." : "Submit Complaint"}
          </button>
        </div>
      </div>
    </div>
  );
}
