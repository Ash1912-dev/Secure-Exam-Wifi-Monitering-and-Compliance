import React from 'react';

const NearbyBluetoothScan = ({ scans }) => {
  return (
    <div className="glass-panel" id="panel-nearby-bluetooth">
      <div className="panel-header">
        <h2>
          <span className="icon">📡</span> Nearby Bluetooth Devices
        </h2>
        <div className="badge">{scans?.length || 0} Devices</div>
      </div>
      
      <div className="panel-content table-container">
        {!scans || scans.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">✓</span>
            <p>No external Bluetooth devices detected</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>MAC Address</th>
                <th>Device Name</th>
                <th>Signal (RSSI)</th>
                <th>Detection Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => {
                const isStrong = scan.strongest_rssi >= -50;
                return (
                  <tr key={scan.mac} className={isStrong ? 'row-warning' : ''}>
                    <td className="font-mono">{scan.mac}</td>
                    <td>{scan.name || 'Unknown Device'}</td>
                    <td>
                      <div className="rssi-indicator">
                        <div 
                          className={`rssi-bar bg-primary`}
                          style={{ width: `${Math.max(0, 100 + scan.strongest_rssi)}%` }}
                        ></div>
                        <span>{scan.strongest_rssi} dBm</span>
                      </div>
                    </td>
                    <td>
                      {new Date(scan.last_seen).toLocaleTimeString()}
                    </td>
                    <td>
                      {isStrong ? (
                        <span className="status-badge risk-high">External Device Detected</span>
                      ) : (
                        <span className="status-badge risk-low">Informational</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default NearbyBluetoothScan;
