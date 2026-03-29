import { useEffect, useMemo, useState } from "react";
import {
  examStart,
  examStop,
  fetchStatus,
  fetchViolations,
  fetchLiveScans,
  deleteStudent,
  deleteAllStudents,
  getExamReport,
  resetSystem,
} from "./api";

import WifiConfigSection from "./components/WifiConfigSection";
import SystemStatusPanel from "./components/SystemStatusPanel";
import StudentManagement from "./components/StudentManagement";
import ViolationLogs from "./components/ViolationLogs";
import NearbyWifiScan from "./components/NearbyWifiScan";
import NearbyBluetoothScan from "./components/NearbyBluetoothScan";
import RogueAPAlert from "./components/RogueAPAlert";
import ViolationChart from "./components/ViolationChart";
import ExamReport from "./components/ExamReport";

export default function App() {
  const [examActive, setExamActive] = useState(false);
  const [students, setStudents] = useState([]);
  const [violations, setViolations] = useState([]);
  const [nearbyScans, setNearbyScans] = useState([]);
  const [nearbyBluetooth, setNearbyBluetooth] = useState([]);
  const [rogueAps, setRogueAps] = useState([]);
  const [allowedSsid, setAllowedSsid] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState(null);

  // ── Polling ──────────────────────────────────────────────
  const refresh = async () => {
    try {
      setLoading(true);
      const [statusData, violationData, scanData] = await Promise.all([
        fetchStatus(),
        fetchViolations(),
        fetchLiveScans().catch(() => ({ scans: [] })),
      ]);
      setExamActive(Boolean(statusData.exam_active));
      setStudents(statusData.students || []);
      setAllowedSsid(statusData.allowed_ssid || "");
      setViolations(violationData.violations || []);
      setNearbyScans(scanData.scans || []);
      setNearbyBluetooth(statusData.nearby_bluetooth || []);
      setRogueAps(statusData.rogue_aps || []);
      setLastSync(new Date());
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  // ── Metrics ──────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = students.length;
    const active = students.filter((s) => s.status === "Active").length;
    const disconnected = students.filter((s) => s.status === "Disconnected").length;
    const violated = students.filter((s) => s.status === "Violated").length;
    return { total, active, disconnected, violated };
  }, [students]);

  // ── Handlers ─────────────────────────────────────────────
  const handleStart = async () => {
    try {
      setLoading(true);
      setShowReport(false);
      await examStart();
      await refresh();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      setLoading(true);
      await examStop();
      await refresh();
      const reportData = await getExamReport();
      setReport(reportData);
      setShowReport(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    if (window.confirm(`Are you sure you want to delete ${studentName}?`)) {
      try {
        await deleteStudent(studentId);
        await refresh();
      } catch (err) {
        setError(`Failed to delete student: ${err.message}`);
      }
    }
  };

  const handleDeleteAllStudents = async () => {
    if (
      window.confirm(
        "WARNING: This will delete ALL students and their data. Are you absolutely sure?"
      )
    ) {
      try {
        setLoading(true);
        await deleteAllStudents();
        await refresh();
      } catch (err) {
        setError(`Failed to delete students: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResetSystem = async () => {
    if (
      window.confirm(
        "This will reset the entire system for a new exam. All data will be cleared. Continue?"
      )
    ) {
      try {
        setLoading(true);
        await resetSystem();
        await refresh();
        setShowReport(false);
        setReport(null);
      } catch (err) {
        setError(`Failed to reset system: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const downloadReport = (format) => {
    if (!report) return;
    let content, filename, mimeType;

    if (format === "json") {
      content = JSON.stringify(report, null, 2);
      filename = `sewcms_report_${new Date().toISOString().split("T")[0]}.json`;
      mimeType = "application/json";
    } else {
      let csv = "Name,Roll,Status,Risk Score,Total Violations\n";
      report.students.forEach((s) => {
        csv += `"${s.name}","${s.roll}","${s.status}",${s.risk_score},${s.total_violations}\n`;
      });
      content = csv;
      filename = `sewcms_report_${new Date().toISOString().split("T")[0]}.csv`;
      mimeType = "text/csv";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="shell">
      {/* ═══ Header ═══ */}
      <header className="topbar glass" id="topbar">
        <div className="topbar-left">
          <h1>🛡️ SEWCMS Admin Console</h1>
          <p>
            Primary Exam WiFi: <strong>{allowedSsid}</strong>
          </p>
        </div>
        <div className="topbar-right">
          <div className="exam-controls" id="exam-controls">
            <button
              onClick={handleStart}
              disabled={examActive || loading}
              className="btn btn-success"
              id="btn-start-exam"
            >
              ▶ Start Exam
            </button>
            <button
              onClick={handleStop}
              disabled={!examActive || loading}
              className="btn btn-danger"
              id="btn-stop-exam"
            >
              ⏹ Stop Exam
            </button>
          </div>
          <div className="sync-info">
            <span className={`exam-pill ${examActive ? "active" : "stopped"}`}>
              {examActive ? "● Exam Running" : "○ Exam Stopped"}
            </span>
            <small className="sync-time">
              Last sync: {lastSync ? lastSync.toLocaleTimeString() : "—"}
            </small>
          </div>
        </div>
      </header>

      {/* ═══ Error Banner ═══ */}
      {error && (
        <div className="error-banner" role="alert">
          ⚠ {error}
          <button className="error-dismiss" onClick={() => setError("")}>✕</button>
        </div>
      )}

      {/* ═══ Rogue AP Spoofing Alert ═══ */}
      <RogueAPAlert rogueAps={rogueAps} />

      {/* ═══ WiFi Config + Status ═══ */}
      <section className="grid-2col fade-in">
        <WifiConfigSection examActive={examActive} onConfigSaved={refresh} />
        <SystemStatusPanel metrics={metrics} />
      </section>

      {/* ═══ Students + Violations ═══ */}
      <section className="grid-main fade-in">
        <StudentManagement
          students={students}
          loading={loading}
          onDeleteStudent={handleDeleteStudent}
          onDeleteAllStudents={handleDeleteAllStudents}
          onRefresh={refresh}
        />
        <ViolationLogs violations={violations} />
      </section>

      {/* ═══ Chart + Nearby WiFi ═══ */}
      <section className="grid-2col fade-in">
        <ViolationChart violations={violations} />
        <NearbyWifiScan scans={nearbyScans} allowedSsid={allowedSsid} />
      </section>

      {/* ═══ Nearby Bluetooth ═══ */}
      <section className="fade-in" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
        <NearbyBluetoothScan scans={nearbyBluetooth} />
      </section>

      {/* ═══ Exam Report ═══ */}
      {showReport && (
        <section className="fade-in">
          <ExamReport
            report={report}
            loading={loading}
            onReset={handleResetSystem}
            onDownload={downloadReport}
          />
        </section>
      )}
    </div>
  );
}
