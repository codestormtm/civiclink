export default function WorkerWorkloadTable({ workers, loading }) {
  if (loading) {
    return <div style={{ color: "#9ca3af", fontSize: 13, padding: "16px 0" }}>Loading workload data...</div>;
  }

  if (!workers || workers.length === 0) {
    return <div style={{ color: "#9ca3af", fontSize: 13, padding: "16px 0" }}>No workers found in your department.</div>;
  }

  const thStyle = {
    padding: "10px 14px", fontSize: 11, fontWeight: 700,
    color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em",
    textAlign: "left", background: "#f9fafb", borderBottom: "1px solid #e5e7eb",
  };

  const tdStyle = {
    padding: "12px 14px", fontSize: 13, color: "#374151",
    borderBottom: "1px solid #f3f4f6",
  };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Worker</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Active</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Assigned</th>
            <th style={{ ...thStyle, textAlign: "center" }}>In Progress</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Completed (30d)</th>
            <th style={{ ...thStyle, textAlign: "center" }}>Total Ever</th>
          </tr>
        </thead>
        <tbody>
          {workers.map((w) => {
            const loadColor =
              w.active_assignments >= 5 ? "#ef4444" :
              w.active_assignments >= 3 ? "#f97316" : "#10b981";
            return (
              <tr key={w.id} style={{ background: "#fff" }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600, color: "#111827" }}>{w.name}</div>
                </td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <span style={{
                    display: "inline-block", minWidth: 32, padding: "3px 8px",
                    background: loadColor + "1a", color: loadColor,
                    borderRadius: 20, fontWeight: 700, fontSize: 13,
                  }}>
                    {w.active_assignments}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: "center", color: "#3b82f6" }}>{w.assigned_count}</td>
                <td style={{ ...tdStyle, textAlign: "center", color: "#f59e0b" }}>{w.in_progress_count}</td>
                <td style={{ ...tdStyle, textAlign: "center", color: "#10b981" }}>{w.completed_last_30_days}</td>
                <td style={{ ...tdStyle, textAlign: "center", color: "#6b7280" }}>{w.total_ever}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
