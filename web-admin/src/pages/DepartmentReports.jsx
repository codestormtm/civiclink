import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import WorkerWorkloadTable from "../components/WorkerWorkloadTable";
import { getDepartment } from "../utils/auth";
import { printHtmlDocument } from "../utils/print";
import { buildReportsPrintHtml } from "../utils/printTemplates";

const PRIORITY_COLORS = {
  CRITICAL: { text: "#dc2626", bg: "#fee2e2" },
  HIGH: { text: "#ea580c", bg: "#fff7ed" },
  MEDIUM: { text: "#2563eb", bg: "#eff6ff" },
  LOW: { text: "#6b7280", bg: "#f3f4f6" },
};

const DEFAULT_PRINT_SECTIONS = {
  workload: true,
  monthly: true,
  priority: true,
};

export default function DepartmentReports() {
  const [workload, setWorkload] = useState([]);
  const [performance, setPerformance] = useState({ monthly: [], by_priority: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [printSections, setPrintSections] = useState(DEFAULT_PRINT_SECTIONS);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [workloadRes, perfRes] = await Promise.all([
          api.get("/dept-admin/workload"),
          api.get("/dept-admin/performance"),
        ]);
        setWorkload(workloadRes.data.data);
        setPerformance(perfRes.data.data);
      } catch (err) {
        setError(err?.response?.data?.error || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const thStyle = {
    padding: "10px 14px",
    fontSize: 11,
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    textAlign: "left",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
  };

  const tdStyle = {
    padding: "11px 14px",
    fontSize: 13,
    color: "#374151",
    borderBottom: "1px solid #f3f4f6",
  };

  const selectedCount = Object.values(printSections).filter(Boolean).length;

  const hasPrintableData = useMemo(() => {
    if (loading || selectedCount === 0) return false;

    return (
      (printSections.workload && workload.length > 0) ||
      (printSections.monthly && performance.monthly.length > 0) ||
      (printSections.priority && performance.by_priority.length > 0)
    );
  }, [loading, selectedCount, printSections, workload, performance]);

  const togglePrintSection = (key) => {
    setPrintSections((current) => ({ ...current, [key]: !current[key] }));
  };

  const handlePrintReports = () => {
    if (!hasPrintableData) return;

    const html = buildReportsPrintHtml({
      departmentName: getDepartment(),
      selectedSections: printSections,
      workload,
      performance,
    });

    printHtmlDocument({
      title: "Department Reports",
      html,
    });
  };

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, color: "#111827" }}>Performance Reports</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
            Worker workload and monthly resolution metrics
          </p>
        </div>
        <div
          style={{
            minWidth: 320,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 14,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Print Reports
          </div>
          <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
            {[
              { key: "workload", label: "Worker Workload", note: "Print worker assignment and completion counts." },
              { key: "monthly", label: "Monthly Performance", note: "Print monthly received, resolved, and SLA metrics." },
              { key: "priority", label: "Priority Breakdown", note: "Print resolution results grouped by priority." },
            ].map((option) => {
              const checked = printSections[option.key];

              return (
                <label
                  key={option.key}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "11px 12px",
                    borderRadius: 10,
                    border: checked ? "1px solid #93c5fd" : "1px solid #e5e7eb",
                    background: checked ? "#eff6ff" : "#f9fafb",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePrintSection(option.key)}
                    style={{ marginTop: 3 }}
                  />
                  <span style={{ display: "block" }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1f2937", marginBottom: 2 }}>
                      {option.label}
                    </span>
                    <span style={{ display: "block", fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
                      {option.note}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <button
            onClick={handlePrintReports}
            disabled={!hasPrintableData}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "none",
              borderRadius: 8,
              background: hasPrintableData ? "#1a56db" : "#d1d5db",
              color: hasPrintableData ? "#fff" : "#9ca3af",
              fontSize: 13,
              fontWeight: 700,
              cursor: hasPrintableData ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
          >
            Print Selected Reports
          </button>
          <div style={{ marginTop: 8, fontSize: 11, color: "#9ca3af" }}>
            {loading
              ? "Reports are still loading."
              : selectedCount === 0
              ? "Select at least one report section."
              : !hasPrintableData
              ? "Selected sections do not currently have data to print."
              : "Only the selected report sections will appear in the print view."}
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ marginBottom: 32 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#374151", fontWeight: 700 }}>
          Worker Workload
        </h3>
        <WorkerWorkloadTable workers={workload} loading={loading} />
      </div>

      <div style={{ marginBottom: 32 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#374151", fontWeight: 700 }}>
          Monthly Performance (Last 6 Months)
        </h3>
        {loading ? (
          <div style={{ color: "#9ca3af", fontSize: 13 }}>Loading...</div>
        ) : performance.monthly.length === 0 ? (
          <div style={{ color: "#9ca3af", fontSize: 13 }}>No data available yet.</div>
        ) : (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Month</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Received</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Resolved</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Resolution Rate</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>SLA Breached</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Avg. Resolution</th>
                </tr>
              </thead>
              <tbody>
                {performance.monthly.map((row, i) => {
                  const rate = row.total_received > 0
                    ? Math.round((row.total_resolved / row.total_received) * 100)
                    : 0;
                  const rateColor = rate >= 80 ? "#10b981" : rate >= 50 ? "#f59e0b" : "#ef4444";
                  return (
                    <tr key={i} style={{ background: "#fff" }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "#111827" }}>{row.month}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{row.total_received}</td>
                      <td style={{ ...tdStyle, textAlign: "center", color: "#10b981", fontWeight: 600 }}>{row.total_resolved}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <span style={{ color: rateColor, fontWeight: 700 }}>{rate}%</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {row.sla_breached > 0 ? (
                          <span style={{ color: "#ef4444", fontWeight: 600 }}>{row.sla_breached}</span>
                        ) : (
                          <span style={{ color: "#10b981" }}>0</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center", color: "#6b7280" }}>
                        {row.avg_resolution_hours != null ? `${row.avg_resolution_hours}h` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && performance.by_priority.length > 0 && (
        <div>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#374151", fontWeight: 700 }}>
            Breakdown by Priority
          </h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {performance.by_priority.map((row) => {
              const colors = PRIORITY_COLORS[row.priority_level] || PRIORITY_COLORS.MEDIUM;
              const rate = row.total > 0 ? Math.round((row.resolved / row.total) * 100) : 0;
              return (
                <div
                  key={row.priority_level}
                  style={{
                    flex: "1 1 180px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: "16px",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "inline-block",
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background: colors.bg,
                      color: colors.text,
                      marginBottom: 12,
                    }}
                  >
                    {row.priority_level}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>Total</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{row.total}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>Resolved</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>{row.resolved}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>SLA Breached</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: row.sla_breached > 0 ? "#ef4444" : "#10b981" }}>
                      {row.sla_breached}
                    </span>
                  </div>
                  <div style={{ background: "#f3f4f6", borderRadius: 4, height: 6 }}>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 4,
                        background: rate >= 80 ? "#10b981" : rate >= 50 ? "#f59e0b" : "#ef4444",
                        width: `${rate}%`,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, textAlign: "right" }}>{rate}% resolved</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
