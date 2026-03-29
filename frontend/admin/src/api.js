const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

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

// Exam Control
export const examStart = () =>
  request("/exam/start", {
    method: "POST",
    body: JSON.stringify({}),
  });

export const examStop = () =>
  request("/exam/stop", {
    method: "POST",
    body: JSON.stringify({}),
  });

// Status & Monitoring
export const fetchStatus = () => request("/status");
export const fetchViolations = () => request("/violations");
export const fetchLiveScans = () => request("/scan/live");

// WiFi Configuration
export const setWifiConfig = (ssid, password) =>
  request("/config/wifi", {
    method: "POST",
    body: JSON.stringify({ ssid, password }),
  });

export const getWifiConfig = () => request("/config/wifi");

// Student Management
export const deleteStudent = (studentId) =>
  request(`/student/${studentId}`, {
    method: "DELETE",
  });

export const deleteAllStudents = () =>
  request("/students/delete-all", {
    method: "POST",
    body: JSON.stringify({}),
  });

// Exam Report (fixed: was /exam/report, backend route is /report/final)
export const getExamReport = () => request("/report/final");

// System Reset
export const resetSystem = () =>
  request("/system/reset", {
    method: "POST",
    body: JSON.stringify({}),
  });
