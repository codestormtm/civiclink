import { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import api from "../api/api";
import socket from "../api/socket";
import ComplaintQueueFilters from "../components/ComplaintQueueFilters";
import SlaWarningCard from "../components/SlaWarningCard";
import AdminComplaintGalleryModal from "../components/AdminComplaintGalleryModal";

const STATUS_COLORS = {
  SUBMITTED: "#6b7280",
  ASSIGNED: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  RESOLVED: "#10b981",
  REJECTED_WRONG_DEPARTMENT: "#ef4444",
  CLOSED: "#9ca3af",
};

const PRIORITY_COLORS = {
  CRITICAL: { text: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
  HIGH:     { text: "#ea580c", bg: "#fff7ed", border: "#fdba74" },
  MEDIUM:   { text: "#2563eb", bg: "#eff6ff", border: "#93c5fd" },
  LOW:      { text: "#6b7280", bg: "#f9fafb", border: "#d1d5db" },
};

function makeMarker(status) {
  const color = STATUS_COLORS[status] || "#6b7280";
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

function getSlaStatus(issue) {
  if (!issue.sla_due_at || ["RESOLVED", "CLOSED", "REJECTED_WRONG_DEPARTMENT"].includes(issue.status)) return null;
  if (issue.sla_breached) return { label: "⚠ SLA BREACHED", color: "#dc2626", bg: "#fee2e2" };
  const hoursLeft = (new Date(issue.sla_due_at) - new Date()) / (1000 * 60 * 60);
  if (hoursLeft < 24) return { label: `⏰ Due in ${Math.max(0, Math.round(hoursLeft))}h`, color: "#ea580c", bg: "#fff7ed" };
  return null;
}

const DEFAULT_FILTERS = {
  status: "", priority: "", sla_breached: false,
  unassigned: false, search: "", date_from: "", date_to: "", issue_type_id: "",
};

const SRI_LANKA = [7.8731, 80.7718];

export default function Dashboard({ focus = "overview" }) {
  const [tab, setTab] = useState(() => (focus === "map" ? "map" : "complaints"));
  const [issues, setIssues] = useState([]);
  const [summary, setSummary] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [mapPoints, setMapPoints] = useState([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editPriority, setEditPriority] = useState("");
  const [selectedComplaintDetail, setSelectedComplaintDetail] = useState(null);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState("");

  const issueTypes = [...new Map(
    issues.map((i) => [i.issue_type_id, { id: i.issue_type_id, name: i.issue_type_name }])
  ).values()];

  const buildQuery = useCallback((f) => {
    const p = new URLSearchParams();
    if (f.status)        p.set("status", f.status);
    if (f.priority)      p.set("priority", f.priority);
    if (f.sla_breached)  p.set("sla_breached", "true");
    if (f.unassigned)    p.set("unassigned", "true");
    if (f.search)        p.set("search", f.search);
    if (f.date_from)     p.set("date_from", f.date_from);
    if (f.date_to)       p.set("date_to", f.date_to);
    if (f.issue_type_id) p.set("issue_type_id", f.issue_type_id);
    return p.toString();
  }, []);

  const fetchIssues = useCallback(async (f = DEFAULT_FILTERS) => {
    setLoading(true);
    try {
      const qs = buildQuery(f);
      const res = await api.get(`/dept-admin/complaints${qs ? "?" + qs : ""}`);
      setIssues(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load complaints");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get("/dept-admin/summary");
      setSummary(res.data.data);
    } catch {
      // non-critical
    }
  }, []);

  const fetchMapPoints = async () => {
    setMapLoading(true);
    try {
      const res = await api.get("/issues/map");
      setMapPoints(res.data.data);
    } catch {
      // silently fail
    } finally {
      setMapLoading(false);
    }
  };

  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
    fetchIssues(newFilters);
  }, [fetchIssues]);

  useEffect(() => {
    if (focus === "map") {
      setTab("map");
      return;
    }

    setTab("complaints");

    if (focus === "sla") {
      handleFiltersChange({ ...DEFAULT_FILTERS, sla_breached: true });
      return;
    }

    if (focus === "queue") {
      handleFiltersChange(DEFAULT_FILTERS);
    }
  }, [focus, handleFiltersChange]);

  const assignWorker = async (complaintId, workerId) => {
    try {
      await api.post("/assignments/assign", { complaint_id: complaintId, worker_user_id: workerId });
      fetchIssues(filters);
      fetchSummary();
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to assign worker");
    }
  };

  const savePriority = async (complaintId) => {
    try {
      await api.patch(`/issues/${complaintId}/priority`, { priority_level: editPriority });
      setEditingId(null);
      fetchIssues(filters);
      fetchSummary();
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to update priority");
    }
  };

  const rejectWrongDepartment = async (complaintId) => {
    const reason = window.prompt("Reason for wrong department rejection:");
    if (!reason) return;
    await api.patch(`/issues/${complaintId}/status`, {
      status: "REJECTED_WRONG_DEPARTMENT",
      rejection_reason: reason,
    });
    fetchIssues(filters);
    fetchSummary();
  };

  const openComplaintGallery = async (complaintId) => {
    setGalleryLoading(true);
    setGalleryError("");
    setSelectedComplaintDetail(null);

    try {
      const res = await api.get(`/dept-admin/complaints/${complaintId}`);
      setSelectedComplaintDetail(res.data.data || null);
    } catch (err) {
      setGalleryError(err?.response?.data?.error || "Failed to load complaint gallery.");
    } finally {
      setGalleryLoading(false);
    }
  };

  const closeComplaintGallery = () => {
    setSelectedComplaintDetail(null);
    setGalleryError("");
  };

  useEffect(() => {
    api.get("/workers").then((res) => setWorkers(res.data.data)).catch(() => {});
    fetchIssues(DEFAULT_FILTERS);
    fetchSummary();

    const refresh = () => { fetchIssues(DEFAULT_FILTERS); fetchSummary(); };
    socket.on("new_issue", refresh);
    socket.on("task_assigned", refresh);
    socket.on("status_updated", refresh);

    return () => {
      socket.off("new_issue", refresh);
      socket.off("task_assigned", refresh);
      socket.off("status_updated", refresh);
    };
  }, [fetchIssues, fetchSummary]);

  useEffect(() => {
    if (tab === "map") fetchMapPoints();
  }, [tab]);

  const stats = summary || {
    total: issues.length,
    submitted: issues.filter((i) => i.status === "SUBMITTED").length,
    assigned: issues.filter((i) => i.status === "ASSIGNED").length,
    in_progress: issues.filter((i) => i.status === "IN_PROGRESS").length,
    resolved: issues.filter((i) => i.status === "RESOLVED").length,
    sla_breached: 0,
  };

  return (
    <div>
      <div className="container">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="dept-workspace-heading">
          <div>
            <p className="section-title">Department Workspace</p>
            <h2>
              {focus === "map"
                ? "Active Issue Map"
                : focus === "sla"
                ? "SLA Alert View"
                : focus === "queue"
                ? "Incoming Issue Queue"
                : "Dashboard Overview"}
            </h2>
          </div>
          <span className="dept-scope-pill">Department data only</span>
        </div>

        {/* Stats */}
        <div className="stats">
          <div className="stat-card">
            <div className="stat-number gray">{stats.total}</div>
            <div className="stat-title">Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-number blue">{stats.assigned}</div>
            <div className="stat-title">Assigned</div>
          </div>
          <div className="stat-card">
            <div className="stat-number teal">{stats.in_progress}</div>
            <div className="stat-title">In Progress</div>
          </div>
          <div className="stat-card">
            <div className="stat-number green">{stats.resolved}</div>
            <div className="stat-title">Resolved</div>
          </div>
          {stats.sla_breached > 0 && (
            <div
              className="stat-card"
              style={{ cursor: "pointer" }}
              onClick={() => handleFiltersChange({ ...DEFAULT_FILTERS, sla_breached: true })}
            >
              <div className="stat-number" style={{ color: "#dc2626" }}>{stats.sla_breached}</div>
              <div className="stat-title" style={{ color: "#dc2626" }}>SLA Breached</div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {["complaints", "map"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 20px", fontSize: 13, fontWeight: 600,
                borderRadius: 8, border: "none", cursor: "pointer",
                fontFamily: "inherit",
                background: tab === t ? "#1a56db" : "#f3f4f6",
                color: tab === t ? "#fff" : "#374151",
              }}
            >
              {t === "complaints" ? "📋 Complaints" : "🗺 Map"}
            </button>
          ))}
        </div>

        {/* Complaints Tab */}
        {tab === "complaints" && (
          <>
            <SlaWarningCard
              count={stats.sla_breached}
              onFilter={() => handleFiltersChange({ ...DEFAULT_FILTERS, sla_breached: true })}
            />

            <ComplaintQueueFilters
              filters={filters}
              onChange={handleFiltersChange}
              issueTypes={issueTypes}
            />

            {loading && (
              <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 12 }}>Loading complaints...</p>
            )}

            <p className="section-title">
              {issues.length} complaint{issues.length !== 1 ? "s" : ""}
              {(filters.status || filters.priority || filters.sla_breached || filters.unassigned || filters.search) && " (filtered)"}
            </p>

            {!loading && issues.length === 0 && (
              <p className="empty">No complaints match the current filters.</p>
            )}

            {issues.map((issue) => {
              const isClosed = ["RESOLVED", "REJECTED_WRONG_DEPARTMENT", "CLOSED"].includes(issue.status);
              const pc = PRIORITY_COLORS[issue.priority_level] || PRIORITY_COLORS.MEDIUM;
              const slaStatus = getSlaStatus(issue);
              const isEditing = editingId === issue.id;

              return (
                <div className="card" key={issue.id}>
                  {/* Badge row + Edit button */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span className={`badge ${
                        issue.status === "SUBMITTED" ? "submitted"
                        : issue.status === "ASSIGNED" ? "assigned"
                        : issue.status === "IN_PROGRESS" ? "inprogress"
                        : "resolved"
                      }`}>
                        {issue.status.replace(/_/g, " ")}
                      </span>

                      {issue.priority_level && !isEditing && (
                        <span style={{
                          padding: "2px 9px", fontSize: 11, fontWeight: 700, borderRadius: 20,
                          color: pc.text, background: pc.bg, border: `1px solid ${pc.border}`,
                        }}>
                          {issue.priority_level}
                        </span>
                      )}

                      {slaStatus && (
                        <span style={{
                          padding: "2px 9px", fontSize: 11, fontWeight: 700, borderRadius: 20,
                          color: slaStatus.color, background: slaStatus.bg,
                        }}>
                          {slaStatus.label}
                        </span>
                      )}
                    </div>

                    {/* Edit / Cancel button */}
                    <button
                      onClick={() => {
                        if (isEditing) {
                          setEditingId(null);
                        } else {
                          setEditingId(issue.id);
                          setEditPriority(issue.priority_level || "MEDIUM");
                        }
                      }}
                      style={{
                        padding: "4px 12px", fontSize: 12, fontWeight: 600,
                        background: isEditing ? "#f3f4f6" : "#eff6ff",
                        color: isEditing ? "#6b7280" : "#1a56db",
                        border: `1px solid ${isEditing ? "#d1d5db" : "#93c5fd"}`,
                        borderRadius: 7, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                      }}
                    >
                      {isEditing ? "✕ Cancel" : "✏ Edit"}
                    </button>
                  </div>

                  {/* Inline edit panel */}
                  {isEditing && (
                    <div style={{
                      background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8,
                      padding: "12px 14px", marginBottom: 12,
                    }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" }}>
                            Priority
                          </div>
                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value)}
                            style={{
                              padding: "7px 10px", fontSize: 13, border: "1px solid #d1d5db",
                              borderRadius: 7, fontFamily: "inherit", background: "#fff",
                            }}
                          >
                            {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ alignSelf: "flex-end" }}>
                          <button
                            onClick={() => savePriority(issue.id)}
                            style={{
                              padding: "7px 18px", fontSize: 13, fontWeight: 700,
                              background: "#1a56db", color: "#fff", border: "none",
                              borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
                            }}
                          >
                            Save Priority
                          </button>
                        </div>
                      </div>

                      {/* Reassign worker (shown in edit mode even if already assigned) */}
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" }}>
                          {issue.assigned_worker_name ? "Reassign Worker" : "Assign Worker"}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) assignWorker(issue.id, e.target.value);
                            }}
                            style={{
                              padding: "7px 10px", fontSize: 13, border: "1px solid #d1d5db",
                              borderRadius: 7, fontFamily: "inherit", background: "#fff", flex: 1,
                            }}
                          >
                            <option value="">Select worker...</option>
                            {workers.map((w) => (
                              <option key={w.id} value={w.id}>{w.full_name || w.name}</option>
                            ))}
                          </select>
                          {issue.assigned_worker_name && (
                            <span style={{ fontSize: 12, color: "#6b7280" }}>
                              Current: <strong>{issue.assigned_worker_name}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <h3 style={{ margin: "0 0 6px" }}>{issue.title}</h3>
                  <p style={{ margin: "0 0 6px" }}>{issue.description}</p>
                  <p><strong>Type:</strong> {issue.issue_type_name}</p>
                  <p><strong>Reporter:</strong> {issue.reporter_name}</p>
                  {(issue.address_text || (issue.latitude && issue.longitude)) && (
                    <p>
                      <strong>Location:</strong>{" "}
                      {issue.address_text && issue.address_text !== "Current Location"
                        ? issue.address_text
                        : issue.latitude && issue.longitude
                        ? `${parseFloat(issue.latitude).toFixed(5)}, ${parseFloat(issue.longitude).toFixed(5)}`
                        : issue.address_text}
                    </p>
                  )}
                  {issue.sla_due_at && (
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 6px" }}>
                      SLA due: {new Date(issue.sla_due_at).toLocaleString()}
                    </p>
                  )}

                  <div className="admin-issue-actions">
                    <button
                      type="button"
                      className="admin-gallery-btn"
                      onClick={() => openComplaintGallery(issue.id)}
                    >
                      View Gallery
                    </button>

                    {!isClosed && !isEditing && (
                      <button className="btn-primary" onClick={() => rejectWrongDepartment(issue.id)}>
                        Reject Wrong Department
                      </button>
                    )}
                  </div>

                  {/* Normal assign row (only when not editing and not closed) */}
                  {!isClosed && !isEditing && (
                    <div className="assign-row">
                      <span className="assign-label">Assign to:</span>
                      <select onChange={(e) => assignWorker(issue.id, e.target.value)} defaultValue="">
                        <option value="" disabled>Select Worker</option>
                        {workers.map((w) => (
                          <option key={w.id} value={w.id}>{w.full_name || w.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {issue.assigned_worker_name && !isEditing && (
                    <p><strong>Assigned Worker:</strong> {issue.assigned_worker_name}</p>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Map Tab */}
        {tab === "map" && (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6b7280" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, border: "2px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                  {status.replace(/_/g, " ")}
                </div>
              ))}
            </div>

            {mapLoading ? (
              <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading map...</p>
            ) : (
              <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                <MapContainer center={SRI_LANKA} zoom={8} style={{ height: 520, width: "100%" }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="© OpenStreetMap contributors"
                  />
                  {mapPoints.map((p) => (
                    <Marker key={p.id} position={[p.latitude, p.longitude]} icon={makeMarker(p.status)}>
                      <Popup>
                        <div style={{ minWidth: 180, fontSize: 13 }}>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.title}</div>
                          <div style={{ color: "#6b7280", marginBottom: 2 }}>{p.department_name}</div>
                          <div style={{ color: "#6b7280", marginBottom: 6 }}>{p.issue_type_name}</div>
                          <span style={{
                            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                            background: STATUS_COLORS[p.status] + "22",
                            color: STATUS_COLORS[p.status],
                          }}>
                            {p.status}
                          </span>
                          {p.address_text && (
                            <div style={{ marginTop: 6, fontSize: 12, color: "#9ca3af" }}>📍 {p.address_text}</div>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )}
            {!mapLoading && mapPoints.length === 0 && (
              <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 12 }}>
                No geo-tagged complaints yet. Complaints with location will appear here.
              </p>
            )}
          </>
        )}
      </div>

      {(selectedComplaintDetail || galleryLoading || galleryError) && (
        <AdminComplaintGalleryModal
          detail={selectedComplaintDetail}
          loading={galleryLoading}
          error={galleryError}
          onClose={closeComplaintGallery}
        />
      )}
    </div>
  );
}
