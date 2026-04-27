import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/api";
import socket from "../api/socket";

const EMPTY_DEPARTMENT_FORM = { name: "", code: "", contact_email: "", contact_phone: "" };
const EMPTY_ADMIN_FORM = { name: "", email: "", password: "", department_id: "" };
const EMPTY_EDIT_FORM = { name: "", code: "", contact_email: "", contact_phone: "", admin_password: "" };
const EMPTY_LOG_FILTERS = { target_key: "", status: "", date_from: "", date_to: "" };
const EMPTY_RESET_FORM = { new_password: "", confirm_password: "" };

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function getSystemColor(status) {
  if (status === "UP") return { bg: "#ecfdf5", text: "#166534", border: "#86efac" };
  if (status === "DOWN") return { bg: "#fef2f2", text: "#b91c1c", border: "#fca5a5" };
  return { bg: "#f3f4f6", text: "#6b7280", border: "#d1d5db" };
}

function getSeverityColor(severity) {
  if (severity === "HIGH") return { bg: "#fef2f2", text: "#b91c1c", border: "#fca5a5" };
  return { bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd" };
}

function buildLogParams(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value)
  );
}

export default function SystemAdmin() {
  const [activeView, setActiveView] = useState("overview");
  const [departments, setDepartments] = useState([]);
  const [deptForm, setDeptForm] = useState(EMPTY_DEPARTMENT_FORM);
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN_FORM);
  const [editingDepartmentId, setEditingDepartmentId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const [summary, setSummary] = useState([]);
  const [departmentActivity, setDepartmentActivity] = useState([]);
  const [workerActivity, setWorkerActivity] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logFilters, setLogFilters] = useState(EMPTY_LOG_FILTERS);

  const [passwordRequests, setPasswordRequests] = useState([]);
  const [unreadRequestCount, setUnreadRequestCount] = useState(0);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [resetForm, setResetForm] = useState(EMPTY_RESET_FORM);

  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingMonitoring, setLoadingMonitoring] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingSelectedRequest, setLoadingSelectedRequest] = useState(false);
  const [savingDepartment, setSavingDepartment] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [downloadingLogs, setDownloadingLogs] = useState(false);
  const [openingRequestLetter, setOpeningRequestLetter] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const navItems = [
    { key: "overview", label: "Platform Overview" },
    { key: "create-department", label: "Department Management" },
    { key: "create-admin", label: "User Management" },
    { key: "departments", label: "Department Directory" },
    { key: "password-requests", label: "Password Requests" },
    { key: "monitoring", label: "Audit & Health" },
    { key: "settings", label: "Platform Settings" },
  ];

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  const fetchDepartments = useCallback(async () => {
    const res = await api.get("/departments");
    setDepartments(res.data.data || []);
  }, []);

  const fetchMonitoring = useCallback(async (nextFilters = logFilters) => {
    setLoadingMonitoring(true);

    try {
      const params = buildLogParams(nextFilters);
      const [
        summaryRes,
        departmentActivityRes,
        workerActivityRes,
        alertsRes,
        incidentsRes,
        logsRes,
      ] = await Promise.all([
        api.get("/system-admin/monitoring/summary"),
        api.get("/system-admin/monitoring/department-activity"),
        api.get("/system-admin/monitoring/worker-activity"),
        api.get("/system-admin/monitoring/alerts"),
        api.get("/system-admin/monitoring/incidents"),
        api.get("/system-admin/monitoring/logs", { params }),
      ]);

      setSummary(summaryRes.data.data || []);
      setDepartmentActivity(departmentActivityRes.data.data || []);
      setWorkerActivity(workerActivityRes.data.data || []);
      setAlerts(alertsRes.data.data || []);
      setIncidents(incidentsRes.data.data || []);
      setLogs(logsRes.data.data || []);
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to load monitoring data.");
    } finally {
      setLoadingMonitoring(false);
    }
  }, [logFilters, showToast]);

  const fetchPasswordRequests = useCallback(async () => {
    setLoadingRequests(true);

    try {
      const [requestsRes, countRes] = await Promise.all([
        api.get("/system-admin/password-reset-requests"),
        api.get("/system-admin/password-reset-requests/unread-count"),
      ]);

      setPasswordRequests(requestsRes.data.data || []);
      setUnreadRequestCount(countRes.data.data?.unread_count || 0);
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to load password reset requests.");
    } finally {
      setLoadingRequests(false);
    }
  }, [showToast]);

  const openPasswordRequest = useCallback(async (request) => {
    if (!request?.id) return;

    setActiveView("password-requests");
    setSelectedRequestId(request.id);
    setLoadingSelectedRequest(true);

    try {
      if (!request.viewed_at) {
        await api.patch(`/system-admin/password-reset-requests/${request.id}/view`);
      }

      const detailRes = await api.get(`/system-admin/password-reset-requests/${request.id}`);
      setSelectedRequest(detailRes.data.data || null);
      setResetForm(EMPTY_RESET_FORM);
      await fetchPasswordRequests();
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to load the selected password request.");
    } finally {
      setLoadingSelectedRequest(false);
    }
  }, [fetchPasswordRequests, showToast]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        await Promise.all([
          fetchDepartments(),
          fetchMonitoring(EMPTY_LOG_FILTERS),
          fetchPasswordRequests(),
        ]);
      } catch (err) {
        if (active) {
          showToast("error", err?.response?.data?.message || "Failed to load system admin data.");
        }
      } finally {
        if (active) setLoadingPage(false);
      }
    })();

    return () => {
      active = false;
      window.clearTimeout(toastTimerRef.current);
    };
  }, [fetchDepartments, fetchMonitoring, fetchPasswordRequests, showToast]);

  useEffect(() => {
    const refreshInterval = window.setInterval(() => {
      fetchDepartments().catch(() => {});
      fetchMonitoring().catch(() => {});
      fetchPasswordRequests().catch(() => {});
    }, 60_000);

    return () => window.clearInterval(refreshInterval);
  }, [fetchDepartments, fetchMonitoring, fetchPasswordRequests]);

  useEffect(() => {
    const handleSystemAlert = (alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 25));
      showToast(alert.severity === "HIGH" ? "error" : "success", alert.message);
      fetchMonitoring().catch(() => {});
    };

    const handlePasswordResetRequestCreated = () => {
      showToast("success", "A new department admin password reset request has arrived.");
      fetchPasswordRequests().catch(() => {});
    };

    socket.on("system_alert", handleSystemAlert);
    socket.on("password_reset_request_created", handlePasswordResetRequestCreated);

    return () => {
      socket.off("system_alert", handleSystemAlert);
      socket.off("password_reset_request_created", handlePasswordResetRequestCreated);
    };
  }, [fetchMonitoring, fetchPasswordRequests, showToast]);

  async function createDepartment() {
    try {
      await api.post("/departments", deptForm);
      setDeptForm(EMPTY_DEPARTMENT_FORM);
      showToast("success", "Department created successfully.");
      await fetchDepartments();
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to create department.");
    }
  }

  async function createAdmin() {
    try {
      await api.post("/system-admin/create-admin", adminForm);
      setAdminForm(EMPTY_ADMIN_FORM);
      showToast("success", "Department admin created successfully.");
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to create department admin.");
    }
  }

  function openEditDepartment(department) {
    setEditingDepartmentId(department.id);
    setEditForm({
      name: department.name || "",
      code: department.code || "",
      contact_email: department.contact_email || "",
      contact_phone: department.contact_phone || "",
      admin_password: "",
    });
  }

  async function saveDepartment(departmentId) {
    if (!editForm.name || !editForm.code || !editForm.admin_password) {
      showToast("error", "Name, code, and system admin password are required.");
      return;
    }

    setSavingDepartment(true);

    try {
      await api.patch(`/departments/${departmentId}`, editForm);
      showToast("success", "Department updated successfully.");
      setEditingDepartmentId(null);
      setEditForm(EMPTY_EDIT_FORM);
      await Promise.all([fetchDepartments(), fetchMonitoring(), fetchPasswordRequests()]);
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to update department.");
    } finally {
      setSavingDepartment(false);
    }
  }

  async function applyLogFilters() {
    await fetchMonitoring(logFilters);
  }

  async function downloadLogs() {
    setDownloadingLogs(true);

    try {
      const res = await api.get("/system-admin/monitoring/logs/download", {
        params: buildLogParams(logFilters),
        responseType: "blob",
      });

      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "monitoring-logs.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to download monitoring logs.");
    } finally {
      setDownloadingLogs(false);
    }
  }

  async function handleResetPassword() {
    if (!selectedRequest?.id) return;

    if (!resetForm.new_password || !resetForm.confirm_password) {
      showToast("error", "Enter the new password and confirm it.");
      return;
    }

    setResettingPassword(true);

    try {
      const res = await api.post(
        `/system-admin/password-reset-requests/${selectedRequest.id}/reset-password`,
        resetForm
      );

      setSelectedRequest(res.data.data || null);
      setResetForm(EMPTY_RESET_FORM);
      showToast("success", res.data.message || "Password reset completed successfully.");
      await fetchPasswordRequests();
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to reset the department admin password.");
    } finally {
      setResettingPassword(false);
    }
  }

  async function openRequestLetter() {
    if (!selectedRequest?.request_letter_url) {
      return;
    }

    setOpeningRequestLetter(true);

    try {
      const res = await api.get(selectedRequest.request_letter_url, {
        responseType: "blob",
      });

      const blobUrl = window.URL.createObjectURL(res.data);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      showToast("error", err?.response?.data?.message || "Failed to open the uploaded request letter.");
    } finally {
      setOpeningRequestLetter(false);
    }
  }

  if (loadingPage) {
    return (
      <div className="sa-page">
        <aside className="sa-sidebar">
          <div className="sa-sidebar-brand">
            <div className="sidebar-brand-icon">C</div>
            <span>CivicLink</span>
          </div>
        </aside>
        <main className="sa-main">
          <div className="sa-header">
            <div className="sa-header-title">CivicLink | System Admin</div>
          </div>
          <div className="sa-content-container">
            <div className="empty">Loading system admin workspace...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="sa-page">
      <aside className="sa-sidebar">
        <div className="sa-sidebar-brand">
          <div className="sidebar-brand-icon">C</div>
          <span>CivicLink</span>
        </div>

        <div className="sa-sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`sa-sidebar-link${activeView === item.key ? " active" : ""}`}
              onClick={() => setActiveView(item.key)}
            >
              <span>{item.label}</span>
              {item.key === "password-requests" && unreadRequestCount > 0 && (
                <span className="sa-mailbox-count">{unreadRequestCount}</span>
              )}
            </button>
          ))}
        </div>
      </aside>

      <main className="sa-main">
        <div className="sa-header">
          <div className="sa-header-title">CivicLink | System Admin</div>
          <div className="sa-header-right">
            <button className="sa-mailbox-btn" onClick={() => setActiveView("password-requests")}>
              <span>Mailbox</span>
              <span className="sa-mailbox-count">{unreadRequestCount}</span>
            </button>
            <span className="sa-role-pill">SYSTEM_ADMIN</span>
            <span className="sa-header-name">{localStorage.getItem("name")}</span>
            <button className="topbar-logout" onClick={() => { localStorage.clear(); window.location.reload(); }}>
              Logout
            </button>
          </div>
        </div>

        <div className="sa-content-container">
          {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

          {activeView === "overview" && (
            <div className="sa-monitor-wrap">
              <div className="sa-overview-hero">
                <div>
                  <p className="section-title" style={{ marginBottom: 6 }}>System Admin Workspace</p>
                  <h2>Platform Overview</h2>
                  <p>
                    Manage departments, department admins, password requests, audit activity, reports, and CivicLink health from one control panel.
                  </p>
                </div>
                <span className="sa-role-pill">SYSTEM_ADMIN</span>
              </div>

              <div className="sa-monitor-grid">
                <div className="sa-monitor-card">
                  <div className="sa-overview-metric">{departments.length}</div>
                  <div className="sa-overview-label">Departments</div>
                  <p className="sa-overview-copy">Configured departments available to the routing system.</p>
                </div>
                <div className="sa-monitor-card">
                  <div className="sa-overview-metric">{unreadRequestCount}</div>
                  <div className="sa-overview-label">Unread Requests</div>
                  <p className="sa-overview-copy">Department admin password requests awaiting review.</p>
                </div>
                <div className="sa-monitor-card">
                  <div className="sa-overview-metric">{alerts.length}</div>
                  <div className="sa-overview-label">Recent Alerts</div>
                  <p className="sa-overview-copy">Current platform health and monitoring alerts.</p>
                </div>
                <div className="sa-monitor-card">
                  <div className="sa-overview-metric">{departmentActivity.length}</div>
                  <div className="sa-overview-label">Reporting Units</div>
                  <p className="sa-overview-copy">Departments included in global activity reporting.</p>
                </div>
              </div>
            </div>
          )}

          {activeView === "create-department" && (
            <div className="sa-section sa-single-panel">
              <p className="section-title">Create Department</p>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>New Department</h2>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
                Add a new government department to CivicLink.
              </p>

              <div className="form-group">
                <label>Department Name</label>
                <input
                  placeholder="e.g. Public Works"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Department Code</label>
                <input
                  placeholder="e.g. MUNICIPAL"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm((prev) => ({ ...prev, code: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Contact Email</label>
                <input
                  placeholder="dept@civic.gov"
                  value={deptForm.contact_email}
                  onChange={(e) => setDeptForm((prev) => ({ ...prev, contact_email: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Contact Phone</label>
                <input
                  placeholder="+94 11 123 4567"
                  value={deptForm.contact_phone}
                  onChange={(e) => setDeptForm((prev) => ({ ...prev, contact_phone: e.target.value }))}
                />
              </div>

              <button className="btn-primary" onClick={createDepartment}>
                Create Department
              </button>
            </div>
          )}

          {activeView === "create-admin" && (
            <div className="sa-section sa-single-panel">
              <p className="section-title">Create Department Admin</p>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>New Department Admin</h2>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
                Create login access for a department administrator.
              </p>

              <div className="form-group">
                <label>Name</label>
                <input
                  placeholder="Admin name"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="admin@email.com"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="Password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Department</label>
                <select
                  value={adminForm.department_id}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, department_id: e.target.value }))}
                >
                  <option value="">Select Department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </div>

              <button className="btn-primary" onClick={createAdmin}>
                Create Department Admin
              </button>
            </div>
          )}

          {activeView === "departments" && (
            <div className="sa-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div>
                  <p className="section-title" style={{ marginBottom: 6 }}>Departments</p>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>Department Directory</h2>
                </div>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{departments.length} departments</span>
              </div>

              {departments.length === 0 && <p className="empty">No departments yet.</p>}

              {departments.map((department) => {
                const isEditing = editingDepartmentId === department.id;

                return (
                  <div className="card" key={department.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <h3>{department.name}</h3>
                        <p>Code: {department.code}</p>
                        <p>Contact Email: {department.contact_email || "-"}</p>
                        <p>Contact Phone: {department.contact_phone || "-"}</p>
                        <p>Complaint Types: {department.issue_type_count}</p>
                        <p>Workers: {department.worker_count}</p>
                        <p>Complaints: {department.complaint_count}</p>
                      </div>
                      <button
                        className="topbar-logout"
                        onClick={() => (isEditing ? setEditingDepartmentId(null) : openEditDepartment(department))}
                      >
                        {isEditing ? "Cancel" : "Edit Department"}
                      </button>
                    </div>

                    {isEditing && (
                      <div className="sa-inline-form">
                        <div className="form-group">
                          <label>Department Name</label>
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                          />
                        </div>

                        <div className="form-group">
                          <label>Department Code</label>
                          <input
                            value={editForm.code}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, code: e.target.value }))}
                          />
                        </div>

                        <div className="form-group">
                          <label>Contact Email</label>
                          <input
                            value={editForm.contact_email}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, contact_email: e.target.value }))}
                          />
                        </div>

                        <div className="form-group">
                          <label>Contact Phone</label>
                          <input
                            value={editForm.contact_phone}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, contact_phone: e.target.value }))}
                          />
                        </div>

                        <div className="form-group">
                          <label>System Admin Password</label>
                          <input
                            type="password"
                            placeholder="Confirm your password"
                            value={editForm.admin_password}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, admin_password: e.target.value }))}
                          />
                        </div>

                        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                          <button className="btn-primary" onClick={() => saveDepartment(department.id)} disabled={savingDepartment}>
                            {savingDepartment ? "Saving..." : "Save Department"}
                          </button>
                          <button className="topbar-logout" onClick={() => setEditingDepartmentId(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeView === "password-requests" && (
            <div className="sa-password-requests-layout">
              <div className="sa-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6 }}>
                  <div>
                    <p className="section-title" style={{ marginBottom: 6 }}>Mailbox</p>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>Password Reset Requests</h2>
                  </div>
                  <button className="topbar-logout" onClick={() => fetchPasswordRequests()}>
                    Refresh Mailbox
                  </button>
                </div>

                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
                  Unread requests: <strong style={{ color: "#111827" }}>{unreadRequestCount}</strong>
                </div>

                {loadingRequests ? (
                  <p className="empty" style={{ padding: "24px 0" }}>Loading password reset requests...</p>
                ) : passwordRequests.length === 0 ? (
                  <p className="empty" style={{ padding: "24px 0" }}>No password reset requests yet.</p>
                ) : (
                  <div className="sa-request-list">
                    {passwordRequests.map((request) => (
                      <button
                        key={request.id}
                        type="button"
                        className={`sa-request-card${selectedRequestId === request.id ? " active" : ""}${!request.viewed_at ? " unread" : ""}`}
                        onClick={() => openPasswordRequest(request)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ textAlign: "left" }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 4 }}>
                              {request.department_name}
                            </div>
                            <div style={{ fontSize: 13, color: "#4b5563" }}>{request.target_name}</div>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>{request.target_email}</div>
                          </div>
                          <span className={`sa-status-pill ${request.status === "COMPLETED" ? "completed" : "pending"}`}>
                            {request.status}
                          </span>
                        </div>

                        <div className="sa-request-meta">
                          <span>{formatDateTime(request.created_at)}</span>
                          {!request.viewed_at && <strong style={{ color: "#1d4ed8" }}>Unread</strong>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="sa-section">
                <p className="section-title" style={{ marginBottom: 6 }}>Selected Request</p>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>Request Details</h2>

                {loadingSelectedRequest ? (
                  <p className="empty" style={{ padding: "24px 0" }}>Loading request details...</p>
                ) : !selectedRequest ? (
                  <p className="empty" style={{ padding: "24px 0" }}>Select a password reset request to review it.</p>
                ) : (
                  <>
                    <div className="sa-detail-grid">
                      <div className="sa-detail-box"><strong>Department</strong><div>{selectedRequest.department_name}</div></div>
                      <div className="sa-detail-box"><strong>Email Address</strong><div>{selectedRequest.target_email}</div></div>
                      <div className="sa-detail-box"><strong>Who Needs Password Reset</strong><div>{selectedRequest.target_name}</div></div>
                      <div className="sa-detail-box"><strong>Role in Department</strong><div>{selectedRequest.target_role}</div></div>
                      <div className="sa-detail-box"><strong>NIC Number</strong><div>{selectedRequest.nic_number}</div></div>
                      <div className="sa-detail-box"><strong>Mobile Number</strong><div>{selectedRequest.mobile_number}</div></div>
                      <div className="sa-detail-box">
                        <strong>Request Letter</strong>
                        <button
                          type="button"
                          className="topbar-logout"
                          onClick={openRequestLetter}
                          disabled={openingRequestLetter}
                        >
                          {openingRequestLetter ? "Opening..." : "Open uploaded letter"}
                        </button>
                      </div>
                      <div className="sa-detail-box"><strong>Status</strong><div>{selectedRequest.status}</div></div>
                      <div className="sa-detail-box"><strong>Viewed</strong><div>{selectedRequest.viewed_at ? `${formatDateTime(selectedRequest.viewed_at)} by ${selectedRequest.viewed_by_name || "System Admin"}` : "Not viewed yet"}</div></div>
                      <div className="sa-detail-box"><strong>Completed</strong><div>{selectedRequest.completed_at ? `${formatDateTime(selectedRequest.completed_at)} by ${selectedRequest.completed_by_name || "System Admin"}` : "Not completed yet"}</div></div>
                    </div>

                    {selectedRequest.status !== "COMPLETED" && (
                      <>
                        <div className="form-group">
                          <label>New Password</label>
                          <input
                            type="password"
                            value={resetForm.new_password}
                            onChange={(e) => setResetForm((prev) => ({ ...prev, new_password: e.target.value }))}
                          />
                        </div>

                        <div className="form-group">
                          <label>Confirm New Password</label>
                          <input
                            type="password"
                            value={resetForm.confirm_password}
                            onChange={(e) => setResetForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
                          />
                        </div>

                        <div className="sa-detail-actions">
                          <button className="btn-primary" onClick={handleResetPassword} disabled={resettingPassword}>
                            {resettingPassword ? "Updating..." : "Set New Password"}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeView === "monitoring" && (
            <div className="sa-monitor-wrap">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <div>
                  <p className="section-title" style={{ marginBottom: 6 }}>Monitoring Center</p>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>System Health, Activity, and Alerts</h2>
                </div>
                <button className="topbar-logout" onClick={() => fetchMonitoring()}>
                  Refresh Monitoring
                </button>
              </div>

              {loadingMonitoring && <p style={{ color: "#6b7280", marginBottom: 16 }}>Refreshing monitoring data...</p>}

              <div className="sa-monitor-grid">
                {summary.map((item) => {
                  const tone = getSystemColor(item.current_status);
                  return (
                    <div className="sa-monitor-card" key={item.target_key}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>
                            {item.label}
                          </div>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "4px 10px",
                              borderRadius: 999,
                              background: tone.bg,
                              color: tone.text,
                              border: `1px solid ${tone.border}`,
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {item.current_status}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>{item.uptime_percent_24h}%</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>24h uptime</div>
                        </div>
                      </div>

                      <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
                        <div className="sa-kv-row"><span>Last checked</span><strong>{formatDateTime(item.last_checked_at)}</strong></div>
                        <div className="sa-kv-row"><span>Open incidents</span><strong>{item.open_incident_count}</strong></div>
                        <div className="sa-kv-row"><span>Last incident</span><strong>{formatDateTime(item.last_incident_at)}</strong></div>
                        <div className="sa-kv-row"><span>Last error</span><strong>{item.last_error_message || "-"}</strong></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="sa-monitor-columns">
                <div className="sa-section" style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <p className="section-title" style={{ marginBottom: 0 }}>Recent Alerts</p>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{alerts.length} alerts</span>
                  </div>

                  {alerts.length === 0 ? (
                    <p className="empty" style={{ padding: "28px 0" }}>No alerts yet.</p>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {alerts.map((alert) => {
                        const tone = getSeverityColor(alert.severity);
                        return (
                          <div
                            key={alert.id}
                            style={{
                              border: `1px solid ${tone.border}`,
                              background: tone.bg,
                              borderRadius: 12,
                              padding: "14px 16px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                              <strong style={{ color: tone.text }}>{alert.label || alert.target_key}</strong>
                              <span style={{ fontSize: 11, fontWeight: 700, color: tone.text }}>{alert.severity}</span>
                            </div>
                            <div style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>{alert.message}</div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>{formatDateTime(alert.created_at)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="sa-section" style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <p className="section-title" style={{ marginBottom: 0 }}>Incident History</p>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{incidents.length} records</span>
                  </div>

                  <div className="sa-table-wrap">
                    <table className="sa-table">
                      <thead>
                        <tr>
                          <th>System</th>
                          <th>Status</th>
                          <th>Started</th>
                          <th>Ended</th>
                          <th>Summary</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incidents.length === 0 ? (
                          <tr><td colSpan="5">No incidents yet.</td></tr>
                        ) : incidents.map((incident) => (
                          <tr key={incident.id}>
                            <td>{incident.label || incident.target_key}</td>
                            <td>{incident.status}</td>
                            <td>{formatDateTime(incident.started_at)}</td>
                            <td>{formatDateTime(incident.ended_at)}</td>
                            <td>{incident.summary}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="sa-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <p className="section-title" style={{ marginBottom: 6 }}>System Check Logs</p>
                    <div style={{ fontSize: 14, color: "#374151" }}>Filter and download uptime or downtime records for each system.</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn-primary" onClick={applyLogFilters}>Apply Filters</button>
                    <button className="topbar-logout" onClick={downloadLogs} disabled={downloadingLogs}>
                      {downloadingLogs ? "Downloading..." : "Download CSV"}
                    </button>
                  </div>
                </div>

                <div className="sa-filter-grid">
                  <div className="form-group">
                    <label>System</label>
                    <select
                      value={logFilters.target_key}
                      onChange={(e) => setLogFilters((prev) => ({ ...prev, target_key: e.target.value }))}
                    >
                      <option value="">All Systems</option>
                      {summary.map((item) => (
                        <option key={item.target_key} value={item.target_key}>{item.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Status</label>
                    <select
                      value={logFilters.status}
                      onChange={(e) => setLogFilters((prev) => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="">All Statuses</option>
                      <option value="UP">UP</option>
                      <option value="DOWN">DOWN</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Date From</label>
                    <input
                      type="date"
                      value={logFilters.date_from}
                      onChange={(e) => setLogFilters((prev) => ({ ...prev, date_from: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label>Date To</label>
                    <input
                      type="date"
                      value={logFilters.date_to}
                      onChange={(e) => setLogFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="sa-table-wrap">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>System</th>
                        <th>Status</th>
                        <th>Response</th>
                        <th>HTTP</th>
                        <th>Error</th>
                        <th>Checked At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.length === 0 ? (
                        <tr><td colSpan="6">No log records match the current filters.</td></tr>
                      ) : logs.map((log) => (
                        <tr key={log.id}>
                          <td>{log.label || log.target_key}</td>
                          <td>{log.status}</td>
                          <td>{log.response_time_ms != null ? `${log.response_time_ms} ms` : "-"}</td>
                          <td>{log.http_status_code || "-"}</td>
                          <td>{log.error_message || "-"}</td>
                          <td>{formatDateTime(log.checked_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="sa-monitor-columns">
                <div className="sa-section" style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <p className="section-title" style={{ marginBottom: 0 }}>Department Activity</p>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{departmentActivity.length} departments</span>
                  </div>

                  <div className="sa-table-wrap">
                    <table className="sa-table">
                      <thead>
                        <tr>
                          <th>Department</th>
                          <th>Total</th>
                          <th>Submitted</th>
                          <th>Assigned</th>
                          <th>In Progress</th>
                          <th>Resolved</th>
                          <th>SLA Breached</th>
                          <th>Workers</th>
                          <th>Inactive Workers</th>
                          <th>Last Activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departmentActivity.length === 0 ? (
                          <tr><td colSpan="10">No department activity available.</td></tr>
                        ) : departmentActivity.map((row) => (
                          <tr key={row.department_id}>
                            <td>{row.department_name}</td>
                            <td>{row.total_complaints}</td>
                            <td>{row.submitted}</td>
                            <td>{row.assigned}</td>
                            <td>{row.in_progress}</td>
                            <td>{row.resolved}</td>
                            <td>{row.sla_breached}</td>
                            <td>{row.worker_count}</td>
                            <td>{row.inactive_worker_count}</td>
                            <td>{formatDateTime(row.last_activity_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="sa-section" style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <p className="section-title" style={{ marginBottom: 0 }}>Worker Activity</p>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{workerActivity.length} workers</span>
                  </div>

                  <div className="sa-table-wrap">
                    <table className="sa-table">
                      <thead>
                        <tr>
                          <th>Worker</th>
                          <th>Department</th>
                          <th>Employment</th>
                          <th>Account</th>
                          <th>Active Assignments</th>
                          <th>Last Activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workerActivity.length === 0 ? (
                          <tr><td colSpan="6">No worker activity available.</td></tr>
                        ) : workerActivity.map((row) => (
                          <tr key={row.worker_id}>
                            <td>{row.worker_name}</td>
                            <td>{row.department_name}</td>
                            <td>{row.employment_status}</td>
                            <td>{row.is_active ? "ACTIVE" : "INACTIVE"}</td>
                            <td>{row.active_assignment_count}</td>
                            <td>{formatDateTime(row.last_activity_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === "settings" && (
            <div className="sa-section sa-single-panel">
              <p className="section-title">Platform Settings</p>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>Operational Defaults</h2>
              <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
                This area is reserved for global routing, SLA, language, and notification defaults. Current settings are enforced by the backend configuration and department records.
              </p>
              <div className="sa-detail-grid">
                <div className="sa-detail-box"><strong>Portal Mode</strong><div>Role separated</div></div>
                <div className="sa-detail-box"><strong>Citizen Routing</strong><div>AI assisted</div></div>
                <div className="sa-detail-box"><strong>Admin Scope</strong><div>Platform-wide</div></div>
                <div className="sa-detail-box"><strong>Monitoring</strong><div>{summary.length ? "Configured" : "No checks loaded"}</div></div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
