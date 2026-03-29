import { useMemo, useState } from "react";

export default function ViolationLogs({ violations }) {
  const [filterStudent, setFilterStudent] = useState("");
  const [filterType, setFilterType] = useState("");

  const violationTypes = useMemo(
    () => [...new Set(violations.map((v) => v.type))],
    [violations]
  );

  const studentRolls = useMemo(
    () => [...new Set(violations.map((v) => v.roll))].sort(),
    [violations]
  );

  const filtered = useMemo(() => {
    let list = violations;
    if (filterStudent) list = list.filter((v) => v.roll === filterStudent);
    if (filterType) list = list.filter((v) => v.type === filterType);
    return list;
  }, [violations, filterStudent, filterType]);

  return (
    <article className="panel glass" id="violation-logs">
      <div className="panel-icon">⚠️</div>
      <h2>Violation Logs</h2>

      <div className="controls-row">
        <select
          value={filterStudent}
          onChange={(e) => setFilterStudent(e.target.value)}
          className="form-input filter-select"
          id="violation-filter-student"
        >
          <option value="">All Students</option>
          {studentRolls.map((roll) => (
            <option key={roll} value={roll}>{roll}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="form-input filter-select"
          id="violation-filter-type"
        >
          <option value="">All Types</option>
          {violationTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div className="table-wrap violation-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Student Name</th>
              <th>Type</th>
              <th>Risk Points</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((item) => (
                <tr
                  key={item.id}
                  className={item.risk_delta >= 30 ? "row-danger" : ""}
                >
                  <td>
                    <small>{new Date(item.timestamp).toLocaleString()}</small>
                  </td>
                  <td>
                    {item.name} <small>({item.roll})</small>
                  </td>
                  <td>
                    <span className={`badge badge-violation badge-${item.type.toLowerCase().replace(/_/g, "-")}`}>
                      {item.type}
                    </span>
                  </td>
                  <td>
                    <span className="risk-badge">+{item.risk_delta}</span>
                  </td>
                  <td><small>{item.details}</small></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="empty-row">
                  No violations match the filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
