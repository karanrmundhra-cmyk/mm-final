import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

const ProjectContext = createContext(null);
const KEY = "mm_project_id";

export function getCurrentProjectId() {
  return localStorage.getItem(KEY) || "";
}

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [currentId, setCurrentId] = useState(() => localStorage.getItem(KEY) || "");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/projects");
      setProjects(data);
      if (!currentId && data.length) {
        const pid = data[0].id;
        localStorage.setItem(KEY, pid);
        setCurrentId(pid);
      }
    } catch {}
  }, [currentId]);

  useEffect(() => {
    const token = localStorage.getItem("mm_token");
    if (token) load();
  }, [load]);

  const select = (id) => {
    localStorage.setItem(KEY, id);
    setCurrentId(id);
    window.dispatchEvent(new Event("mm:project-changed"));
  };

  const current = projects.find(p => p.id === currentId) || projects[0];

  return (
    <ProjectContext.Provider value={{ projects, current, currentId, select, reload: load }}>
      {children}
    </ProjectContext.Provider>
  );
}

export const useProjects = () => useContext(ProjectContext);
