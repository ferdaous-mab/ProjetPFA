import { useState, useEffect } from "react";
import HomePage         from "./pages/HomePage";
import LoginPage        from "./pages/LoginPage";
import EnrollPage       from "./pages/EnrollPage";
import AdminDashboard   from "./pages/AdminDashboard";
import ProfDashboard    from "./pages/ProfDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import ResetPasswordPage from "./pages/ResetPasswordPage";

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("loading");
  const [resetToken, setResetToken] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("token");
    if (token) {
      setResetToken(token);
      setPage("reset-password");
      return;
    }
    try {
      const authToken = localStorage.getItem("token");
      const saved     = localStorage.getItem("user");
      if (authToken && saved) {
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
    setPage("home");
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setPage("dashboard");
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setPage("home");
  };

  if (page === "loading") return null;

  if (page === "reset-password") {
    return (
      <ResetPasswordPage
        token={resetToken}
        onDone={() => {
          window.history.replaceState({}, "", window.location.pathname);
          setResetToken(null);
          setPage("login");
        }}
      />
    );
  }

  if (page === "home") {
    return (
      <HomePage
        onGoToLogin={() => setPage("login")}
        onGoToEnroll={() => setPage("enroll")}
      />
    );
  }

  if (page === "login") {
    return (
      <LoginPage
        onLogin={handleLogin}
        onGoToEnroll={() => setPage("enroll")}
        onGoHome={() => setPage("home")}
      />
    );
  }

  if (page === "enroll") {
    return (
      <EnrollPage
        onGoToLogin={() => setPage("login")}
        onGoHome={() => setPage("home")}
      />
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
    <HomePage
      onGoToLogin={() => setPage("login")}
      onGoToEnroll={() => setPage("enroll")}
    />
  );
}