import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <div style={{ padding: "10px", background: "#222", color: "white" }}>
      <Link to="/" style={{ marginRight: 15, color: "white" }}>Student</Link>
      <Link to="/admin" style={{ color: "white" }}>Admin</Link>
    </div>
  );
}
