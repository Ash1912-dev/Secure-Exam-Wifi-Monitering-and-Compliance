export default function NearbyWifiScan({ scans, allowedSsid }) {
  const getSignalStrength = (rssi) => {
    if (rssi >= -50) return { label: "Excellent", cls: "signal-excellent" };
    if (rssi >= -60) return { label: "Good", cls: "signal-good" };
    if (rssi >= -70) return { label: "Fair", cls: "signal-fair" };
    return { label: "Weak", cls: "signal-weak" };
  };

  return (
    <article className="panel glass" id="nearby-wifi">
      <div className="panel-icon">📶</div>
      <h2>Nearby WiFi Networks</h2>
      <div className="wifi-scan-list">
        {scans.length > 0 ? (
          scans.map((item) => {
            const signal = getSignalStrength(item.strongest_rssi ?? item.rssi ?? -100);
            const ssid = item.ssid || "Hidden Network";
            const isAllowed = ssid === allowedSsid;
            return (
              <div
                key={ssid}
                className={`wifi-scan-item ${isAllowed ? "scan-allowed" : ""}`}
              >
                <div className="scan-ssid">
                  <strong>{ssid}</strong>
                  {isAllowed && <span className="badge badge-active">Primary</span>}
                </div>
                <div className="scan-meta">
                  <span className={`signal-badge ${signal.cls}`}>
                    {item.strongest_rssi ?? item.rssi} dBm · {signal.label}
                  </span>
                  {item.seen_count && (
                    <small>Seen {item.seen_count}×</small>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="empty-row">No nearby networks detected</p>
        )}
      </div>
    </article>
  );
}
