export default function ExamReport({ report, loading, onReset, onDownload }) {
  if (!report) return null;

  return (
    <article className="panel glass report-panel" id="exam-report">
      <div className="panel-icon">📋</div>
      <h2>Exam Summary Report</h2>

      {/* Summary Cards */}
      <div className="report-summary-grid">
        <div className="report-stat">
          <div className="report-stat-value">{report.summary.total_students}</div>
          <div className="report-stat-label">Total Students</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-value danger">{report.summary.total_violations}</div>
          <div className="report-stat-label">Total Violations</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-value warning">{report.summary.total_risk_points}</div>
          <div className="report-stat-label">Total Risk Points</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-value">{report.summary.average_risk}</div>
          <div className="report-stat-label">Average Risk</div>
        </div>
      </div>

      {/* Violation Breakdown */}
      <h3>Violation Breakdown</h3>
      <div className="breakdown-grid">
        {Object.entries(report.summary.violation_type_breakdown || {}).map(
          ([type, count]) => (
            <div key={type} className="breakdown-card">
              <span className="breakdown-type">{type}</span>
              <strong className="breakdown-count">{count}</strong>
            </div>
          )
        )}
      </div>

      {/* Student Scores Table */}
      <h3>Student Scores</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Roll</th>
              <th>Status</th>
              <th>Risk Score</th>
              <th>Violations</th>
            </tr>
          </thead>
          <tbody>
            {report.students.map((s) => (
              <tr
                key={s.roll}
                className={s.risk_score >= 40 ? "row-danger" : s.risk_score >= 20 ? "row-warning" : ""}
              >
                <td>{s.name}</td>
                <td><code>{s.roll}</code></td>
                <td>
                  <span className={`badge badge-${s.status.toLowerCase().replace(/ /g, "-")}`}>
                    {s.status}
                  </span>
                </td>
                <td>
                  <span className={`risk-num ${s.risk_score >= 40 ? "high" : s.risk_score >= 20 ? "mid" : "low"}`}>
                    {s.risk_score}
                  </span>
                </td>
                <td>{s.total_violations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="report-actions">
        <button onClick={() => onDownload("json")} className="btn btn-secondary">
          ⬇ Download JSON
        </button>
        <button onClick={() => onDownload("csv")} className="btn btn-secondary">
          ⬇ Download CSV
        </button>
        <button onClick={onReset} className="btn btn-reset" disabled={loading}>
          🔄 Reset System for New Exam
        </button>
      </div>
    </article>
  );
}
