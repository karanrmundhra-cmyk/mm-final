import React, { useEffect, useState } from "react";
import "@/App.css";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ProjectProvider } from "@/lib/projects";
import AppShell from "@/components/AppShell";
import SplashScreen from "@/components/SplashScreen";
import ErrorBoundary from "@/components/ErrorBoundary";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Tasks from "@/pages/Tasks";
import Routines from "@/pages/Routines";
import CashFlow from "@/pages/CashFlow";
import Notes from "@/pages/Notes";
import Reminders from "@/pages/Reminders";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import People from "@/pages/People";
import Vault from "@/pages/Vault";
import RecycleBin from "@/pages/RecycleBin";
import Invite from "@/pages/Invite";
import Calendar from "@/pages/Calendar";
import Projects from "@/pages/Projects";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <SplashScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

/* Wrap every page in its own ErrorBoundary so one crash stays isolated */
const W = ({ C }) => <ErrorBoundary><C /></ErrorBoundary>;

function Root() {
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 1400);
    return () => clearTimeout(t);
  }, []);
  if (booting) return <SplashScreen />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/invite/:token" element={<Invite />} />
      <Route path="/" element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index                 element={<W C={Dashboard} />} />
        <Route path="tasks"          element={<W C={Tasks} />} />
        <Route path="routines"       element={<W C={Routines} />} />
        <Route path="cash-flow"      element={<W C={CashFlow} />} />
        <Route path="cashflow"       element={<Navigate to="/cash-flow" replace />} />
        <Route path="notes"          element={<W C={Notes} />} />
        <Route path="reminders"      element={<W C={Reminders} />} />
        <Route path="calendar"       element={<W C={Calendar} />} />
        <Route path="reports"        element={<W C={Reports} />} />
        <Route path="settings"       element={<W C={Settings} />} />
        <Route path="people"         element={<W C={People} />} />
        <Route path="vault"          element={<W C={Vault} />} />
        <Route path="projects"       element={<W C={Projects} />} />
        <Route path="trash"          element={<W C={RecycleBin} />} />
        <Route path="loans"          element={<Navigate to="/cash-flow" replace />} />
        <Route path="investments"    element={<Navigate to="/cash-flow" replace />} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App mm-font-body">
      <AuthProvider>
        <ProjectProvider>
          <BrowserRouter>
            <Root />
          </BrowserRouter>
        </ProjectProvider>
      </AuthProvider>
      <Toaster
        theme="dark"
        position="bottom-left"
        offset={24}
        toastOptions={{
          style: {
            background: "rgba(17,17,20,0.97)",
            border: "1px solid rgba(212,175,55,0.3)",
            color: "#F0EDE8",
            backdropFilter: "blur(16px)",
            borderRadius: "16px",
            fontFamily: "'Outfit', sans-serif",
            fontSize: "13px",
          },
        }}
      />
    </div>
  );
}
