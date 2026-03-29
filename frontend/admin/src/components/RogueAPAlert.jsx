import React from 'react';

const RogueAPAlert = ({ rogueAps }) => {
  if (!rogueAps || rogueAps.length === 0) return null;

  return (
    <div className="glass-panel" style={{ borderColor: 'var(--accent-red)', background: 'rgba(255, 60, 60, 0.1)', marginBottom: '1.5rem' }}>
      <div className="panel-header">
        <h2 style={{ color: 'var(--accent-red)' }}>
          <span className="icon">🚨</span> CRITICAL SECURITY ALERT: ROGUE AP DETECTED
        </h2>
      </div>
      <div className="panel-content">
        <p style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Multiple access points are broadcasting the official Exam WiFi network name. Someone is active spoofing the network to intercept students!
        </p>
        <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
          {rogueAps.map((ap) => (
            <li key={ap.bssid} style={{ padding: '0.75rem', background: 'rgba(255, 60, 60, 0.2)', borderRadius: 'var(--radius)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#ffb3b3' }}>Spoofed BSSID (MAC):</strong> <span className="font-mono">{ap.bssid}</span>
              </div>
              <div className="rssi-indicator" style={{ minWidth: '150px' }}>
                <div 
                  className="rssi-bar bg-error"
                  style={{ width: `${Math.max(0, 100 + ap.strongest_rssi)}%` }}
                ></div>
                <span>{ap.strongest_rssi} dBm</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default RogueAPAlert;
