import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCitizenI18n } from "../i18n";
import { ArrowRightIcon, CrosshairIcon, LocationIcon, TrashIcon } from "./PublicIcons";

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
      { headers: { "Accept-Language": "en" } },
    );
    const data = await res.json();
    return data.display_name || null;
  } catch {
    return null;
  }
}

export default function LocationPickerCard({ onLocationPicked }) {
  const { t } = useCitizenI18n();
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
      window.alert(t("location.error.unsupported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
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
      () => window.alert(t("location.error.failed")),
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
    <div className="location-picker-card">
      <div className="location-picker-header">
        <div className="location-picker-kicker">{t("location.kicker")}</div>
        <div className="location-picker-title">{t("location.title")}</div>
        <div className="location-picker-copy">{t("location.copy")}</div>
      </div>

      <div className="location-picker-actions">
        <button type="button" onClick={handleGPS} className="citizen-action-btn is-primary">
          <CrosshairIcon size={16} />
          {t("location.useLocation")}
        </button>
        <button type="button" onClick={handleClear} disabled={!hasLocation} className="citizen-action-btn is-danger">
          <TrashIcon size={16} />
          {t("location.clear")}
        </button>
        <div className="location-picker-helper">
          <LocationIcon size={14} />
          {t("location.helper")}
        </div>
      </div>

      <div className="location-picker-map-shell">
        <MapContainer
          center={hasLocation ? [location.latitude, location.longitude] : SRI_LANKA}
          zoom={hasLocation ? 16 : 8}
          className="location-picker-map"
          scrollWheelZoom
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

      <div className="location-picker-footer">
        {geocoding ? <div className="location-picker-status">{t("location.status")}</div> : null}

        {!hasLocation && !geocoding ? (
          <div className="location-picker-state">{t("location.empty")}</div>
        ) : null}

        {hasLocation && !geocoding ? (
          <div className="location-picker-state is-selected">
            <span className="location-picker-state-label">{t("location.selected")}</span>
            <span>{location.address_text}</span>
            <span className="location-picker-coordinates">
              {location.latitude?.toFixed(5)}, {location.longitude?.toFixed(5)}
            </span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!hasLocation || geocoding}
          className="location-picker-confirm-btn"
        >
          <ArrowRightIcon size={16} />
          {t("location.confirm")}
        </button>
      </div>
    </div>
  );
}
