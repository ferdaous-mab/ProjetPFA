import { useState, useEffect } from "react";
import LoginPage        from "./pages/LoginPage";
import EnrollPage       from "./pages/EnrollPage";
import AdminDashboard   from "./pages/AdminDashboard";
import ProfDashboard    from "./pages/ProfDashboard";
import StudentDashboard from "./pages/StudentDashboard";

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("loading");

  useEffect(() => {
    try {
      const token  = localStorage.getItem("token");
      const saved  = localStorage.getItem("user");
      if (token && saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role) {
          setUser(parsed);
          setPage("dashboard");
          return;
        }
      }
    } catch {
      localStorage.clear();
    }
    setPage("login");
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setPage("dashboard");
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setPage("login");
  };

  if (page === "loading") return null;

  if (page === "login") {
    return (
      <LoginPage
        onLogin={handleLogin}
        onGoToEnroll={() => setPage("enroll")}
      />
    );
  }

  if (page === "enroll") {
    return (
      <EnrollPage onGoToLogin={() => setPage("login")} />
    );
  }

  if (page === "dashboard" && user !== null) {
    if (user.role === "admin") {
      return <AdminDashboard user={user} onLogout={handleLogout} />;
    }
    if (user.role === "professeur") {
      return <ProfDashboard user={user} onLogout={handleLogout} />;
    }
    if (user.role === "etudiant") {
      return <StudentDashboard user={user} onLogout={handleLogout} />;
    }
  }

  return (
    <LoginPage
      onLogin={handleLogin}
      onGoToEnroll={() => setPage("enroll")}
    />
  );
}