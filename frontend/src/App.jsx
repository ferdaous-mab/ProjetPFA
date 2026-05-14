import { useState, useEffect, useRef } from "react";
import axios               from "axios";
import LoginPage           from "./pages/LoginPage";
import EnrollPage          from "./pages/EnrollPage";
import AdminDashboard      from "./pages/AdminDashboard";
import ProfDashboard       from "./pages/ProfDashboard";
import StudentDashboard    from "./pages/StudentDashboard";
import ResetPasswordPage   from "./pages/ResetPasswordPage";

export default function App() {
  const [user,       setUser]       = useState(null);
  const [page,       setPage]       = useState("loading");
  const [resetToken, setResetToken] = useState(null);
  const logoutRef = useRef(null);

  // Intercepteur global : tout 401 → déconnexion automatique
  useEffect(() => {
    const id = axios.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 401 && logoutRef.current) {
          logoutRef.current();
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  useEffect(() => {
    // Détecter un token de reset dans l'URL (?token=xxx)
    const params = new URLSearchParams(window.location.search);
    const rt = params.get("token");
    if (rt) {
      setResetToken(rt);
      setPage("resetPassword");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

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

  // Garde la référence à jour pour l'intercepteur
  logoutRef.current = handleLogout;

  if (page === "loading") return null;

  if (page === "resetPassword") {
    return (
      <ResetPasswordPage
        token={resetToken}
        onDone={() => { setResetToken(null); setPage("login"); }}
      />
    );
  }

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