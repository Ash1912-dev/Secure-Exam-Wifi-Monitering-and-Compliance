import { useState } from "react";

export default function WifiConnectionPage({
  wifiConfig,
  onContinue,
  error,
  loading,
  examActive,
}) {
  const [connecting, setConnecting] = useState(false);

  const handleContinue = async () => {
    setConnecting(true);
    await onContinue();
    setConnecting(false);
  };

  const ssid = wifiConfig?.primary_ssid || "EXAM_WIFI";
  const password = wifiConfig?.primary_password || "N/A";

  if (!examActive) {
    return (
      <div className="page">
        <div className="card glass">
          <div className="card-icon">⏳</div>
          <h1>Exam Not Active</h1>
          <p className="subtitle">
            The exam has not started yet. Please wait for the administrator to
            start the exam.
          </p>
          <div className="info-banner">
            This page auto-checks every 5 seconds. It will update when the exam begins.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card glass">
        <div className="card-icon">📡</div>
        <h1>Connect to Exam WiFi</h1>
        <p className="subtitle">
          Before you can proceed, connect your device to the exam network.
        </p>

        <div className="wifi-credentials">
          <div className="credential-item">
            <span className="credential-label">Network SSID</span>
            <div className="credential-value">{ssid}</div>
          </div>
          <div className="credential-item">
            <span className="credential-label">Password</span>
            <div className="credential-value mono">{password}</div>
          </div>
        </div>

        <div className="steps-box">
          <h3>📋 Connection Steps</h3>
          <ol>
            <li>Open your device WiFi settings</li>
            <li>Search for "<strong>{ssid}</strong>"</li>
            <li>Enter the password shown above</li>
            <li>Wait for connection to establish</li>
            <li>Click the button below to proceed</li>
          </ol>
        </div>

        {error && <div className="error-banner">⚠ {error}</div>}

        <button
          onClick={handleContinue}
          disabled={loading || connecting}
          className="btn btn-primary btn-full"
        >
          {connecting ? "Verifying connection..." : "✓ I have connected to Exam WiFi"}
        </button>

        <div className="warning-note">
          ⚠️ Do not use any other network during the exam.
        </div>
      </div>
    </div>
  );
}
