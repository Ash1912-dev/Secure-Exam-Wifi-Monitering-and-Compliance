function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function statusBadgeClass(status) {
  if (status === "Violation") return "badge badge-danger";
  if (status === "Disconnected") return "badge badge-warning";
  return "badge badge-success";
}

function riskClass(score) {
  if (score >= 40) return "risk-critical";
  if (score >= 20) return "risk-warning";
  return "risk-ok";
}

export default function ExamSessionPage({
  session,
  status,
  riskScore,
  lastSync,
  sessionTime,
  onLogout,
  loading,
  error,
}) {
  const ssid = session?.allowed_ssid || "EXAM_WIFI";
  const password = session?.allowed_password || "";

  return (
    <div className="page">
      <div className="card glass exam-card">
        {/* ─── Header ─── */}
        <div className="exam-header">
          <div className="exam-header-left">
            <h1>🛡️ Exam in Progress</h1>
            <p className="subtitle">
              {session?.name} · <code>{session?.roll}</code>
            </p>
          </div>
          <div className="timer-box">
            <div className="timer-value">{formatTime(sessionTime)}</div>
            <div className="timer-label">Elapsed</div>
          </div>
        </div>

        {/* ─── Status Cards ─── */}
        <div className="session-status-grid">
          <div className="session-stat">
            <span className="stat-label">Connection</span>
            <span className={statusBadgeClass(status)}>{status}</span>
          </div>
          <div className="session-stat">
            <span className="stat-label">Risk Score</span>
            <span className={`stat-value ${riskClass(riskScore)}`}>{riskScore}</span>
          </div>
          <div className="session-stat">
            <span className="stat-label">Last Sync</span>
            <span className="stat-value mono">
              {lastSync ? new Date(lastSync).toLocaleTimeString() : "—"}
            </span>
          </div>
        </div>

        {/* ─── Status Banners ─── */}
        {status === "Disconnected" && (
          <div className="alert alert-danger slide-in">
            ⚠️ Connection Lost — Reconnect to the exam WiFi immediately!
          </div>
        )}

        {status === "Violation" && (
          <div className="alert alert-warning slide-in">
            ⚠️ Violation Detected — You may have switched networks. Reconnect now.
          </div>
        )}

        {status === "Connected" && (
          <div className="alert alert-success">
            ✓ Connected to exam network — Stay connected throughout the exam.
          </div>
        )}

        {/* ─── Reminders ─── */}
        <div className="reminders">
          <h3>📌 Important Reminders</h3>
          <ul>
            <li>Stay connected to: <strong style={{color: "var(--accent-blue)"}}>{ssid}</strong></li>
            {password && <li>Password: <code style={{background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px"}}>{password}</code></li>}
            <li>Do not switch to another network</li>
            <li>Do not use hotspots or VPN</li>
            <li>System checks your connection every 5 seconds</li>
            <li>Each violation increases your risk score</li>
          </ul>
        </div>

        {/* ─── Errors ─── */}
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading && <p className="syncing-text">Syncing...</p>}

        {/* ─── Logout ─── */}
        <button onClick={onLogout} className="btn btn-logout btn-full">
          ⏹ End Exam Session
        </button>
      </div>
    </div>
  );
}
