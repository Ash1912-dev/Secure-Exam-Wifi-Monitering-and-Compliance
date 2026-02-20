import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";

import Navbar from "./components/Navbar";
import StudentLogin from "./components/StudentLogin";
import StudentExam from "./components/StudentExam";
import AdminDashboard from "./components/AdminDashboard";

export default function App() {
  const [roll, setRoll] = useState(null);

  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />

        <Route path="/" element={
          roll
            ? <StudentExam roll={roll} />
            : <StudentLogin onLogin={setRoll} />
        } />
      </Routes>
    </BrowserRouter>
  );
}
