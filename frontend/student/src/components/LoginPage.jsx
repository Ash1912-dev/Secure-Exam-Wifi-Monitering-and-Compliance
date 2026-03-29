import { useState } from "react";

export default function LoginPage({ onLogin, error, loading, examActive }) {
  const [form, setForm] = useState({ name: "", roll: "" });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.roll.trim()) return;
    await onLogin(form);
  };

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
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card glass">
        <div className="card-icon">🔐</div>
        <h1>Student Login</h1>
        <p className="subtitle">Enter your details to join the exam session</p>

        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-group">
            <label htmlFor="student-name">Full Name</label>
            <input
              type="text"
              id="student-name"
              name="name"
              placeholder="Enter your full name"
              value={form.name}
              onChange={handleChange}
              disabled={loading}
              required
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="student-roll">Roll Number</label>
            <input
              type="text"
              id="student-roll"
              name="roll"
              placeholder="Enter your roll number"
              value={form.roll}
              onChange={handleChange}
              disabled={loading}
              required
              autoComplete="off"
            />
          </div>

          {error && <div className="error-banner">⚠ {error}</div>}

          <button
            type="submit"
            disabled={loading || !form.name.trim() || !form.roll.trim()}
            className="btn btn-primary btn-full"
          >
            {loading ? "Logging in..." : "▶ Start Exam Session"}
          </button>
        </form>

        <div className="success-note">
          ✓ Ensure you are connected to the exam WiFi network before proceeding.
        </div>
      </div>
    </div>
  );
}
