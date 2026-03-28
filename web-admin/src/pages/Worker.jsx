import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import api from "../api/api";
import socket from "../api/socket";

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#1a56db;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function Worker() {
  const [tasks, setTasks] = useState([]);
  const name = localStorage.getItem("name") || "Worker";

  const logout = () => {
    localStorage.clear();
    window.location.reload();
  };

  const fetchTasks = async () => {
    const res = await api.get("/worker/assignments");
    setTasks(res.data.data);
  };

  useEffect(() => {
    api.get("/worker/assignments").then((res) => setTasks(res.data.data));
    socket.on("task_assigned", fetchTasks);
    socket.on("status_updated", fetchTasks);
    return () => {
      socket.off("task_assigned", fetchTasks);
      socket.off("status_updated", fetchTasks);
    };
  }, []);

  const updateStatus = async (id, status) => {
    await api.patch(`/worker/assignments/${id}/status`, { status });
    fetchTasks();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6" }}>
      <div className="topbar">
        <div className="topbar-title">CivicLink — Worker Dashboard</div>
        <div className="topbar-right">
          <span className="topbar-role">WORKER</span>
          <span className="topbar-name">{name}</span>
          <button className="topbar-logout" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="container">
        <p className="section-title" style={{ marginBottom: 16 }}>My Assigned Tasks</p>

        {tasks.length === 0 && (
          <p className="empty">No tasks assigned yet.</p>
        )}

        {tasks.map((task) => {
          const hasLocation = task.latitude != null && task.longitude != null;
          const lat = parseFloat(task.latitude);
          const lng = parseFloat(task.longitude);

          return (
            <div className="card" key={task.id}>
              <h3>{task.title}</h3>
              <p>{task.description}</p>
              <p><strong>Type:</strong> {task.complaint_type}</p>
              <p><strong>Department:</strong> {task.department_name}</p>
              <p>
                <strong>Status:</strong>{" "}
                <span className={`badge ${
                  task.complaint_status === "ASSIGNED" ? "assigned"
                  : task.complaint_status === "IN_PROGRESS" ? "inprogress"
                  : "resolved"
                }`}>
                  {task.complaint_status}
                </span>
              </p>

              {/* Location */}
              {hasLocation && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 13 }}>
                    📍 Location:{" "}
                    <span style={{ fontWeight: 400, color: "#6b7280" }}>
                      {task.address_text && task.address_text !== "Current Location"
                        ? task.address_text
                        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
                    </span>
                  </p>
                  <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                    <MapContainer
                      center={[lat, lng]}
                      zoom={15}
                      style={{ height: 220, width: "100%" }}
                      scrollWheelZoom={false}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="© OpenStreetMap contributors"
                      />
                      <Marker position={[lat, lng]} icon={pinIcon} />
                    </MapContainer>
                  </div>
                </div>
              )}

              {!hasLocation && (
                <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 8 }}>
                  📍 No location provided for this complaint.
                </p>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {task.complaint_status === "ASSIGNED" && (
                  <button className="btn-primary" style={{ width: "auto" }} onClick={() => updateStatus(task.id, "IN_PROGRESS")}>
                    Start Work
                  </button>
                )}
                {task.complaint_status === "IN_PROGRESS" && (
                  <button className="btn-primary" style={{ width: "auto", background: "#0e9f6e", border: "none" }} onClick={() => updateStatus(task.id, "RESOLVED")}>
                    Mark Complete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
