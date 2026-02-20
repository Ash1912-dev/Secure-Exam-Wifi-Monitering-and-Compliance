import { useState, useEffect } from "react";
import API from "../services/api";

export default function StudentExam({ roll }) {
  const [ssid, setSsid] = useState("EXAM_WIFI");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const t = setInterval(sendHeartbeat, 5000);
    return () => clearInterval(t);
  }, [ssid]);

  const sendHeartbeat = async () => {
    const res = await API.post("/heartbeat", { roll, ssid });
    setStatus(res.data.status);
  };

  return (
    <div className="container">

      <div className="card">
        <h3>Student Exam Session</h3>

        <p>Connected SSID</p>
        <input value={ssid} onChange={e => setSsid(e.target.value)} />

        <p>Status: {status}</p>
      </div>

    </div>
  );
}
