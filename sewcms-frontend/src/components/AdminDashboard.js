import { useState, useEffect } from "react";
import API from "../services/api";
import { FaWifi, FaUser, FaExclamationTriangle } from "react-icons/fa";

export default function AdminDashboard() {
  const [status, setStatus] = useState({});
  const [violations, setViolations] = useState([]);

  const startExam = async () => {
    await API.post("/exam/start");
    loadStatus();
  };

  const stopExam = async () => {
    const res = await API.post("/exam/stop");
    setViolations(res.data.violations);
    loadStatus();
  };

  const loadStatus = async () => {
    const res = await API.get("/status");
    setStatus(res.data);
    setViolations(res.data.violations);
  };

  useEffect(() => {
    loadStatus();
    const t = setInterval(loadStatus, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="container">

      <h2>Admin Dashboard</h2>

      {/* STATUS CARDS */}
      <div className="row">

        <div className="card">
          <FaWifi size={22}/>
          <p>Exam Mode</p>
          <h3 className={status.exam_mode ? "on" : "off"}>
            {status.exam_mode ? "ON" : "OFF"}
          </h3>
        </div>

        <div className="card">
          <FaUser size={22}/>
          <p>Total Students</p>
          <h3>
            {status.students ? Object.keys(status.students).length : 0}
          </h3>
        </div>

        <div className="card">
          <FaExclamationTriangle size={22}/>
          <p>Violations</p>
          <h3 className="warn">{violations.length}</h3>
        </div>

      </div>

      {/* CONTROLS */}
      <div className="actions">
        <button onClick={startExam}>Start Exam</button>
        <button onClick={stopExam}>Stop Exam</button>
      </div>

      {/* STUDENT TABLE */}
      <h3>Students</h3>

      <table>
        <thead>
          <tr>
            <th>Roll</th>
            <th>Name</th>
            <th>Last Seen</th>
            <th>SSID</th>
          </tr>
        </thead>

        <tbody>
          {status.students &&
            Object.entries(status.students).map(([roll, s]) => (
              <tr key={roll}>
                <td>{roll}</td>
                <td>{s.name}</td>
                <td>{s.last_seen}</td>
                <td>{s.ssid}</td>
              </tr>
          ))}
        </tbody>
      </table>

      {/* VIOLATIONS TABLE */}
      <h3>Violations Report</h3>

      <table>
        <thead>
          <tr>
            <th>Roll</th>
            <th>Name</th>
            <th>Type</th>
            <th>Details</th>
            <th>Time</th>
          </tr>
        </thead>

        <tbody>
          {violations.map((v, i) => (
            <tr key={i} className="danger">
              <td>{v.roll}</td>
              <td>{v.name}</td>
              <td>{v.type}</td>
              <td>{v.details}</td>
              <td>{v.time}</td>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
}
