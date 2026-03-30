const API_BASE = import.meta.env.VITE_API_BASE || "http://192.168.1.7:5000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

export function getWifiConfig() {
  return request("/config/wifi");
}

export function getExamStatus() {
  return request("/status");
}

export function studentLogin(payload) {
  return request("/student/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function sendHeartbeat(payload) {
  return request("/heartbeat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchStatus() {
  return request("/status");
}
