import { useEffect, useState } from "react";
import {
  getWifiConfig,
  getExamStatus,
  studentLogin,
  sendHeartbeat,
  fetchStatus,
} from "./api";

import WifiConnectionPage from "./components/WifiConnectionPage";
import LoginPage from "./components/LoginPage";
import ExamSessionPage from "./components/ExamSessionPage";

const SESSION_KEY = "sewcms_student_session";
const FLOW = {
  WIFI: "wifi",
  LOGIN: "login",
  EXAM: "exam",
};

function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  // ── Flow & Session ────────────────────────────────────
  const [flow, setFlow] = useState(() =>
    getStoredSession() ? FLOW.EXAM : FLOW.WIFI
  );
  const [session, setSession] = useState(getStoredSession);
  const [wifiConfig, setWifiConfig] = useState(null);

  // ── Exam Status ───────────────────────────────────────
  const [examActive, setExamActive] = useState(false);
  const [status, setStatus] = useState("Disconnected");
  const [riskScore, setRiskScore] = useState(0);
  const [sessionTime, setSessionTime] = useState(0);

  // ── UI State ──────────────────────────────────────────
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // ── Persist session ───────────────────────────────────
  useEffect(() => {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [session]);

  // ── Load WiFi config ──────────────────────────────────
  useEffect(() => {
    getWifiConfig()
      .then(setWifiConfig)
      .catch((err) => console.error("WiFi config load failed:", err));
  }, []);

  // ── Poll exam status ──────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const data = await getExamStatus();
        setExamActive(Boolean(data.exam_active));
      } catch (err) {
        console.error("Exam status check failed:", err);
      }
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  // ── Session timer ─────────────────────────────────────
  useEffect(() => {
    if (flow !== FLOW.EXAM || !session) return;
    const id = setInterval(() => setSessionTime((p) => p + 1), 1000);
    return () => clearInterval(id);
  }, [flow, session]);

  // ── Heartbeat (5s) ────────────────────────────────────
  useEffect(() => {
    if (flow !== FLOW.EXAM || !session) return;
    let mounted = true;

    const sync = async () => {
      try {
        await sendHeartbeat({
          token: session.token,
          ssid: session.current_ssid,
        });

        if (!mounted) return;

        const dashboard = await fetchStatus();
        const me = dashboard.students.find((s) => s.roll === session.roll);

        if (me) {
          setRiskScore(me.risk_score);
          setStatus(
            me.status === "Violated"
              ? "Violation"
              : me.status === "Disconnected"
              ? "Disconnected"
              : "Connected"
          );
        }

        setLastSync(new Date());
        setError("");
      } catch (err) {
        if (mounted) {
          setStatus("Disconnected");
          setError(err.message);
        }
      }
    };

    sync();
    const id = setInterval(sync, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [flow, session]);

  // ── Handlers ──────────────────────────────────────────
  const handleWifiContinue = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getExamStatus();
      if (!data.exam_active) {
        setError("Exam is not active. Please wait for the administrator.");
        setLoading(false);
        return;
      }
      setExamActive(true);
      setFlow(FLOW.LOGIN);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (form) => {
    try {
      setLoading(true);
      setError("");
      const result = await studentLogin({ name: form.name, roll: form.roll });

      setSession({
        token: result.token,
        name: result.student.name,
        roll: result.student.roll,
        status: result.student.status,
        risk_score: result.student.risk_score,
        current_ssid: result.student.current_ssid,
        allowed_ssid: result.allowed_ssid,
        allowed_password: result.allowed_password,
      });
      setStatus(result.student.status);
      setRiskScore(result.student.risk_score);
      setFlow(FLOW.EXAM);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to end your exam session?")) {
      setSession(null);
      setFlow(FLOW.WIFI);
      setSessionTime(0);
      setStatus("Disconnected");
      setRiskScore(0);
      setError("");
    }
  };

  // ── Render ────────────────────────────────────────────
  if (flow === FLOW.WIFI) {
    return (
      <WifiConnectionPage
        wifiConfig={wifiConfig}
        onContinue={handleWifiContinue}
        error={error}
        loading={loading}
        examActive={examActive}
      />
    );
  }

  if (flow === FLOW.LOGIN) {
    return (
      <LoginPage
        onLogin={handleLogin}
        error={error}
        loading={loading}
        examActive={examActive}
      />
    );
  }

  return (
    <ExamSessionPage
      session={session}
      status={status}
      riskScore={riskScore}
      lastSync={lastSync}
      sessionTime={sessionTime}
      onLogout={handleLogout}
      loading={loading}
      error={error}
    />
  );
}
