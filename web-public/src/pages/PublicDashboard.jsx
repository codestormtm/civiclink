import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import api from "../api/api";

const STATUS_COLORS = {
  SUBMITTED: "#6b7280",
  ASSIGNED: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  RESOLVED: "#10b981",
  REJECTED_WRONG_DEPARTMENT: "#ef4444",
  CLOSED: "#9ca3af",
};

function makeMarker(status) {
  const color = STATUS_COLORS[status] || "#6b7280";
  return L.divIcon({
    className: "",
    html: `<div style="width:13px;height:13px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [13, 13],
    iconAnchor: [6, 6],
    popupAnchor: [0, -10],
  });
}

const SRI_LANKA = [7.8731, 80.7718];

export default function PublicDashboard() {
  const [stats, setStats] = useState(null);
  const [recentResolved, setRecentResolved] = useState([]);
  const [departmentSummary, setDepartmentSummary] = useState([]);
  const [mapPoints, setMapPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/public/stats"),
      api.get("/public/recent-resolved"),
      api.get("/public/department-summary"),
      api.get("/public/complaints/map"),
    ])
      .then(([statsRes, resolvedRes, summaryRes, mapRes]) => {
        setStats(statsRes.data.data);
        setRecentResolved(resolvedRes.data.data);
        setDepartmentSummary(summaryRes.data.data);
        setMapPoints(mapRes.data.data || []);
      })
      .catch(() => setError("Failed to load dashboard data."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6" }}>
      {/* Navbar */}
      <div className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">C</div>
          <div>
            <div className="navbar-name">CivicLink</div>
            <div className="navbar-sub">Public Transparency Portal</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => { window.location.href = "/"; }}
            style={{
              fontSize: 13, fontWeight: 600, color: "#ffffff",
              background: "#1a56db", border: "none", borderRadius: 8,
              padding: "8px 18px", cursor: "pointer", fontFamily: "inherit",
              width: "auto",
            }}
          >
            Submit a Complaint
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="hero">
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 12, letterSpacing: 0.5 }}>
          Government of Sri Lanka
        </div>
        <div className="hero-title">Public Complaint Transparency</div>
        <div className="hero-subtitle">
          Real-time statistics on citizen complaints submitted across all government departments.
          Our commitment to open governance.
        </div>
      </div>

      <div className="container">
        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af", fontSize: 14 }}>
            Loading statistics...
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            {stats && (
              <div className="stats" style={{ marginTop: 0 }}>
                <div className="stat-card">
                  <div className="stat-icon blue">📋</div>
                  <div className="stat-info">
                    <div className="stat-number blue">{stats.total_complaints}</div>
                    <div className="stat-title">Total Complaints</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon green">✅</div>
                  <div className="stat-info">
                    <div className="stat-number green">{stats.resolved_complaints}</div>
                    <div className="stat-title">Resolved</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon teal">⚙️</div>
                  <div className="stat-info">
                    <div className="stat-number teal">{stats.in_progress_complaints}</div>
                    <div className="stat-title">In Progress</div>
                  </div>
                </div>
              </div>
            )}

            {/* Department Summary */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h3 style={{ margin: 0 }}>Complaints by Department</h3>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>{departmentSummary.length} departments</span>
              </div>

              {departmentSummary.length === 0 ? (
                <p className="empty-text">No departments found.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {departmentSummary.map((dept) => {
                    const pct = dept.total_complaints > 0
                      ? Math.round((dept.resolved_complaints / dept.total_complaints) * 100)
                      : 0;
                    return (
                      <div key={dept.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{dept.name}</span>
                          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6b7280" }}>
                            <span><strong style={{ color: "#111827" }}>{dept.total_complaints}</strong> total</span>
                            <span style={{ color: "#0e9f6e", fontWeight: 600 }}>{dept.resolved_complaints} resolved</span>
                            <span style={{ color: "#0694a2", fontWeight: 600 }}>{dept.active_complaints} active</span>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div style={{ height: 6, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
                          <div style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: "linear-gradient(90deg, #0e9f6e, #1a56db)",
                            borderRadius: 999,
                            transition: "width 0.4s ease",
                          }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{pct}% resolved</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Complaint Map */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>Complaint Locations</h3>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>{mapPoints.length} geo-tagged</span>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "0 20px 10px" }}>
                {Object.entries(STATUS_COLORS).map(([status, color]) => (
                  <div key={status} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6b7280" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, border: "1.5px solid white", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }} />
                    {status.replace(/_/g, " ")}
                  </div>
                ))}
              </div>

              <MapContainer center={SRI_LANKA} zoom={8} style={{ height: 400, width: "100%" }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="© OpenStreetMap contributors"
                />
                {mapPoints.map((p) => (
                  <Marker key={p.id} position={[p.latitude, p.longitude]} icon={makeMarker(p.status)}>
                    <Popup>
                      <div style={{ minWidth: 170, fontSize: 13 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.title}</div>
                        <div style={{ color: "#6b7280", marginBottom: 2 }}>{p.department_name}</div>
                        <div style={{ color: "#6b7280", marginBottom: 6 }}>{p.issue_type_name}</div>
                        <span style={{
                          padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: (STATUS_COLORS[p.status] || "#6b7280") + "22",
                          color: STATUS_COLORS[p.status] || "#6b7280",
                        }}>
                          {p.status}
                        </span>
                        {p.address_text && (
                          <div style={{ marginTop: 6, fontSize: 11, color: "#9ca3af" }}>📍 {p.address_text}</div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>

              {mapPoints.length === 0 && (
                <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "12px 0 16px" }}>
                  No geo-tagged complaints yet.
                </p>
              )}
            </div>

            {/* Recent Resolved */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h3 style={{ margin: 0 }}>Recently Resolved</h3>
                <span className="badge badge-resolved">Live</span>
              </div>

              {recentResolved.length === 0 ? (
                <p className="empty-text">No resolved complaints yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {recentResolved.map((item, i) => (
                    <div key={item.id} style={{
                      padding: "14px 0",
                      borderBottom: i < recentResolved.length - 1 ? "1px solid #f3f4f6" : "none",
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "#111827", marginBottom: 4 }}>
                          {item.title}
                        </div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            🏛 {item.department_name}
                          </span>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            📌 {item.complaint_type}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <span className="badge badge-resolved">Resolved</span>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                          {item.resolved_at ? new Date(item.resolved_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer note */}
            <div style={{ textAlign: "center", padding: "16px 0 32px", fontSize: 12, color: "#9ca3af" }}>
              Data updates in real time · Government of Sri Lanka · CivicLink Transparency Initiative
            </div>
          </>
        )}
      </div>
    </div>
  );
}
