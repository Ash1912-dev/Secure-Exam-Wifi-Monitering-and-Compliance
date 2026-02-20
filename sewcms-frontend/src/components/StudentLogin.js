import { useState } from "react";
import API from "../services/api";

export default function StudentLogin({ onLogin }) {
  const [name, setName] = useState("");
  const [roll, setRoll] = useState("");

  const login = async () => {
    await API.post("/student/login", { name, roll });
    onLogin(roll);
  };

  return (
    <div className="card">
      <h3>Student Login</h3>

      <input
        placeholder="Name"
        value={name}
        onChange={e => setName(e.target.value)}
      /><br/>

      <input
        placeholder="Roll No"
        value={roll}
        onChange={e => setRoll(e.target.value)}
      /><br/>

      <button onClick={login}>Login</button>
    </div>
  );
}
