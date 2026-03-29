import { useEffect, useState } from "react";
import { fetchStatus } from "../api";

export default function WifiConfigSection() {
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    // Poll the status to keep the UI in sync with the ESP32
    const loadConfig = async () => {
      try {
        const status = await fetchStatus();
        setSsid(status.allowed_ssid || "—");
        setPassword(status.allowed_password || "—");
      } catch (err) {
        console.error("Failed to load WiFi config from status:", err);
      }
    };
    loadConfig();
    const id = setInterval(loadConfig, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <article className="panel glass wifi-section" id="wifi-config">
      <div className="panel-icon">📡</div>
      <h2>Active Exam Network</h2>
      
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        The system is automatically synchronized with the hardware monitor. The credentials below are currently active.
      </p>

      <div className="form-group">
        <label>Exam SSID (Network Name)</label>
        <div className="form-input" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', cursor: 'default' }}>
          {ssid}
        </div>
      </div>
      <div className="form-group">
        <label>Network Password</label>
        <div className="form-input font-mono" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', cursor: 'default', letterSpacing: '1px' }}>
          {password}
        </div>
      </div>
      
      {ssid && ssid !== "—" && (
        <div className="info-badge success mt-3" style={{ background: 'rgba(40, 167, 69, 0.2)', border: '1px solid var(--accent-green)'}}>
          <span style={{color: 'var(--accent-green)'}}>Hardware Synced: Validating against <strong>{ssid}</strong></span>
        </div>
      )}
    </article>
  );
}
