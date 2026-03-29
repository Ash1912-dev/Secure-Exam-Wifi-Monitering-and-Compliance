import { useMemo, useState } from "react";

function riskClass(status, risk) {
  if (status === "Violated" || risk >= 40) return "row-danger";
  if (status === "Disconnected" || risk >= 20) return "row-warning";
  return "";
}

export default function StudentManagement({
  students,
  loading,
  onDeleteStudent,
  onDeleteAllStudents,
  onRefresh,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");

  const filtered = useMemo(() => {
    let list = students.filter(
      (s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.roll.toLowerCase().includes(searchTerm.toLowerCase())
    );
    list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "risk") return b.risk_score - a.risk_score;
      if (sortBy === "status") return a.status.localeCompare(b.status);
      return 0;
    });
    return list;
  }, [students, searchTerm, sortBy]);

  return (
    <article className="panel glass" id="student-management">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-icon">🎓</div>
          <h2>Student Management</h2>
        </div>
        <button className="btn btn-outline" onClick={onRefresh} disabled={loading}>
          {loading ? "Syncing..." : "↻ Refresh"}
        </button>
      </div>

      <div className="controls-row">
        <input
          type="text"
          placeholder="Search by name or roll..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="form-input search-input"
          id="student-search"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="form-input sort-select"
          id="student-sort"
        >
          <option value="name">Sort by Name</option>
          <option value="risk">Sort by Risk</option>
          <option value="status">Sort by Status</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Roll No</th>
              <th>Status</th>
              <th>Risk Score</th>
              <th>Last Seen</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student) => (
              <tr key={student.roll} className={riskClass(student.status, student.risk_score)}>
                <td>{student.name}</td>
                <td><code>{student.roll}</code></td>
                <td>
                  <span className={`badge badge-${student.status.toLowerCase().replace(/ /g, "-")}`}>
                    {student.status}
                  </span>
                </td>
                <td>
                  <span className={`risk-num ${student.risk_score >= 40 ? "high" : student.risk_score >= 20 ? "mid" : "low"}`}>
                    {student.risk_score}
                  </span>
                </td>
                <td>
                  <small>
                    {student.last_seen
                      ? new Date(student.last_seen).toLocaleTimeString()
                      : "N/A"}
                  </small>
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => onDeleteStudent(student.id, student.name)}
                  >
                    ✕ Delete
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan="6" className="empty-row">
                  {searchTerm || students.length === 0
                    ? "No students found"
                    : "No students logged in"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {students.length > 0 && (
        <button
          onClick={onDeleteAllStudents}
          className="btn btn-danger delete-all-btn"
          disabled={loading}
        >
          🗑 Delete All Students
        </button>
      )}
    </article>
  );
}
