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
  useMapEvents({
    click: (event) => onPick(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

function RecenterMap({ lat, lng }) {
  const map = useMap();

  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 16, { duration: 0.75 });
    }
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
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    address_text: "",
    location_source: "",
  });
  const [geocoding, setGeocoding] = useState(false);

  const hasLocation = location.latitude != null && location.longitude != null;

  const handleGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGeocoding(true);
        const address = await reverseGeocode(lat, lng);
        setGeocoding(false);
        setLocation({
          latitude: lat,
          longitude: lng,
          address_text: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          location_source: "gps",
        });
      },
      () => alert("Unable to get location. Please pin it on the map.")
    );
  };

  const handleMapClick = async (lat, lng) => {
    setGeocoding(true);
    const address = await reverseGeocode(lat, lng);
    setGeocoding(false);
    setLocation({
      latitude: lat,
      longitude: lng,
      address_text: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      location_source: "pin",
    });
  };

  const handleConfirm = () => {
    if (hasLocation) {
      onLocationPicked(location);
    }
  };

  const handleClear = () => {
    setLocation({
      latitude: null,
      longitude: null,
      address_text: "",
      location_source: "",
    });
  };

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #fffefb 0%, #fff7e9 100%)",
        border: "1px solid #ead8bc",
        borderRadius: 16,
        overflow: "hidden",
        marginBottom: 12,
        width: "100%",
        boxShadow: "0 12px 30px rgba(77, 34, 12, 0.08)",
      }}
    >
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #efe2cf", background: "rgba(255,255,255,0.72)" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#8a1538", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Location needed
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1f1720", marginBottom: 4 }}>
          Drop a pin where the complaint happened
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
          Use your current GPS location or tap directly on the map. The selected address stays visible until you confirm it.
        </div>
      </div>

      <div style={{ padding: "12px 16px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleGPS}
          style={{
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            background: "#1a56db",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "inherit",
            width: "auto",
          }}
        >
          Use My Location
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasLocation}
          style={{
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            background: hasLocation ? "#fff" : "#f6f0e6",
            color: hasLocation ? "#b42318" : "#9ca3af",
            border: "1px solid #e5d3bf",
            borderRadius: 8,
            cursor: hasLocation ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            width: "auto",
          }}
        >
          Clear
        </button>
        <div style={{ fontSize: 12, color: "#6b7280", alignSelf: "center" }}>
          Tap or click the map to place the marker.
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <MapContainer
          center={hasLocation ? [location.latitude, location.longitude] : SRI_LANKA}
          zoom={hasLocation ? 16 : 8}
          style={{ height: 320, width: "100%", borderRadius: 14 }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="OpenStreetMap contributors"
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

      <div style={{ padding: "0 16px 16px" }}>
        {geocoding && (
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>Getting address...</div>
        )}

        {!hasLocation && !geocoding && (
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              background: "#fffdf8",
              border: "1px dashed #e5d3bf",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 10,
            }}
          >
            No location selected yet. Pick a point on the map or use your current location.
          </div>
        )}

        {hasLocation && !geocoding && (
          <div
            style={{
              fontSize: 12,
              color: "#374151",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span style={{ color: "#166534", fontWeight: 700 }}>Selected location</span>
            <span>{location.address_text}</span>
            <span style={{ color: "#6b7280" }}>
              {location.latitude?.toFixed(5)}, {location.longitude?.toFixed(5)}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!hasLocation || geocoding}
          style={{
            width: "100%",
            padding: "11px 0",
            fontSize: 13,
            fontWeight: 700,
            background: hasLocation && !geocoding ? "#0e9f6e" : "#d1d5db",
            color: hasLocation && !geocoding ? "#fff" : "#9ca3af",
            border: "none",
            borderRadius: 10,
            cursor: hasLocation && !geocoding ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}
        >
          Confirm Location
        </button>
      </div>
    </div>
  );
}
