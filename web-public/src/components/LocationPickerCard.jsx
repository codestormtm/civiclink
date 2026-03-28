import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

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

async function reverseGeocode(lat, lng) {
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
}

export default function LocationPickerCard({ onLocationPicked }) {
  const [location, setLocation] = useState({ latitude: null, longitude: null, address_text: "", location_source: "" });
  const [geocoding, setGeocoding] = useState(false);

  const hasLocation = location.latitude != null && location.longitude != null;

  const handleGPS = () => {
    if (!navigator.geolocation) { alert("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setGeocoding(true);
      const address = await reverseGeocode(lat, lng);
      setGeocoding(false);
      setLocation({ latitude: lat, longitude: lng, address_text: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, location_source: "gps" });
    }, () => alert("Unable to get location. Please pin on the map."));
  };

  const handleMapClick = async (lat, lng) => {
    setGeocoding(true);
    const address = await reverseGeocode(lat, lng);
    setGeocoding(false);
    setLocation({ latitude: lat, longitude: lng, address_text: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, location_source: "pin" });
  };

  const handleConfirm = () => {
    if (hasLocation) onLocationPicked(location);
  };

  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      overflow: "hidden", marginBottom: 12, maxWidth: "85%",
    }}>
      {/* Buttons */}
      <div style={{ padding: "10px 12px", display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid #f3f4f6" }}>
        <button
          onClick={handleGPS}
          style={{
            padding: "6px 12px", fontSize: 12, fontWeight: 600,
            background: "#1a56db", color: "#fff", border: "none",
            borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          📍 Use My Location
        </button>
        <span style={{ fontSize: 12, color: "#9ca3af", alignSelf: "center" }}>or pin on map below</span>
      </div>

      {/* Map */}
      <MapContainer center={hasLocation ? [location.latitude, location.longitude] : SRI_LANKA} zoom={hasLocation ? 15 : 8} style={{ height: 220, width: "100%" }} scrollWheelZoom={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
        <MapClickHandler onPick={handleMapClick} />
        {hasLocation && (
          <>
            <RecenterMap lat={location.latitude} lng={location.longitude} />
            <Marker position={[location.latitude, location.longitude]} icon={pinIcon} />
          </>
        )}
      </MapContainer>

      {/* Address badge + confirm */}
      <div style={{ padding: "10px 12px" }}>
        {geocoding && (
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>Getting address...</div>
        )}
        {hasLocation && !geocoding && (
          <div style={{
            fontSize: 12, color: "#374151", background: "#f0fdf4",
            border: "1px solid #bbf7d0", borderRadius: 7, padding: "7px 10px",
            marginBottom: 10, display: "flex", gap: 6, alignItems: "flex-start",
          }}>
            <span style={{ color: "#16a34a", flexShrink: 0 }}>✓</span>
            <span>{location.address_text}</span>
          </div>
        )}
        <button
          onClick={handleConfirm}
          disabled={!hasLocation || geocoding}
          style={{
            width: "100%", padding: "9px 0", fontSize: 13, fontWeight: 700,
            background: hasLocation && !geocoding ? "#0e9f6e" : "#d1d5db",
            color: hasLocation && !geocoding ? "#fff" : "#9ca3af",
            border: "none", borderRadius: 8, cursor: hasLocation && !geocoding ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}
        >
          Confirm Location →
        </button>
      </div>
    </div>
  );
}
