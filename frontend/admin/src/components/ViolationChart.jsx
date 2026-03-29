import { useMemo } from "react";

export default function ViolationChart({ violations }) {
  const chartData = useMemo(() => {
    return violations.reduce((acc, item) => {
      const key = item.type;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [violations]);

  const chartMax = Math.max(1, ...Object.values(chartData));

  return (
    <article className="panel glass" id="violation-chart">
      <div className="panel-icon">📈</div>
      <h2>Violation Count by Type</h2>
      <div className="chart">
        {Object.keys(chartData).length === 0 && (
          <p className="empty-row">No violations yet</p>
        )}
        {Object.entries(chartData).map(([type, count]) => (
          <div key={type} className="chart-row">
            <span className="chart-label">{type}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(count / chartMax) * 100}%` }}
              >
                <span className="bar-value">{count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
