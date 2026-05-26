import axios from "axios";
import { getCurrentProjectId } from "@/lib/projects";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL?.replace("/api","") || "http://localhost:8001";
export const API = process.env.REACT_APP_API_URL || `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

const PROJECT_SCOPED = ["/tasks","/routines","/transactions","/notes","/reminders","/deadlines","/dashboard"];

function shouldScope(url) {
  if (!url) return false;
  return PROJECT_SCOPED.some(base => url === base || url.startsWith(`${base}/`));
}

api.interceptors.request.use(config => {
  const token = localStorage.getItem("mm_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const pid = getCurrentProjectId();
  if (pid && shouldScope(config.url || "")) {
    if ((config.method || "get").toLowerCase() === "get") {
      config.params = { ...(config.params || {}), project_id: pid };
    } else if (
      config.data && typeof config.data === "object" &&
      !(config.data instanceof FormData) && !Array.isArray(config.data) &&
      config.data.project_id === undefined
    ) {
      config.data = { ...config.data, project_id: pid };
    }
  }
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err?.response?.status === 401) localStorage.removeItem("mm_token");
    return Promise.reject(err);
  }
);

import("./syncQueue");

export async function uploadAttachment(module, rowId, file) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post(`/${module}/${rowId}/attachments`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
