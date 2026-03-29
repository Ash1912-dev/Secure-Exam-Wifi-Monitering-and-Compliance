export default function SystemStatusPanel({ metrics }) {
  return (
    <article className="panel glass status-panel" id="system-status">
      <div className="panel-icon">📊</div>
      <h2>Live System Status</h2>
      <div className="status-grid">
        <div className="status-card card-total">
          <div className="status-number">{metrics.total}</div>
          <div className="status-label">Total Students</div>
        </div>
        <div className="status-card card-active">
          <div className="status-number">{metrics.active}</div>
          <div className="status-label">Active</div>
        </div>
        <div className="status-card card-violated">
          <div className="status-number">{metrics.violated}</div>
          <div className="status-label">Violated</div>
        </div>
        <div className="status-card card-disconnected">
          <div className="status-number">{metrics.disconnected}</div>
          <div className="status-label">Disconnected</div>
        </div>
      </div>
    </article>
  );
}
