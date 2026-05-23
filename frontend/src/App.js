import React, { useEffect, useState } from "react";
import "@/App.css";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ProjectProvider } from "@/lib/projects";
import AppShell from "@/components/AppShell";
import SplashScreen from "@/components/SplashScreen";
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

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <SplashScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

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
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="routines" element={<Routines />} />
        <Route path="cash-flow" element={<CashFlow />} />
        <Route path="cashflow" element={<Navigate to="/cash-flow" replace />} />
        <Route path="notes" element={<Notes />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="calendar" element={<Navigate to="/reminders" replace />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="people" element={<People />} />
        <Route path="vault" element={<Vault />} />
        <Route path="trash" element={<RecycleBin />} />
        <Route path="loans" element={<Navigate to="/cash-flow" replace />} />
        <Route path="investments" element={<Navigate to="/cash-flow" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
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
            background: "linear-gradient(180deg,rgba(26,21,10,.95),rgba(14,13,10,.95))",
            border: "1px solid rgba(201,169,97,.35)",
            color: "#E4C98C",
            backdropFilter: "blur(16px)",
          },
        }}
      />
    </div>
  );
}
