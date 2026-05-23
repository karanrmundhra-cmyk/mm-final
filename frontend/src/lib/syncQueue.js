import Dexie from "dexie";
import { api } from "@/lib/api";

const db = new Dexie("mm_offline");
db.version(1).stores({ queue: "++id,method,url,created_at" });

let _listeners = [];
let _state = { online: navigator.onLine, pending: 0, lastSyncAt: null };

function notify() { _listeners.forEach(fn => fn({ ..._state })); }

export function subscribeSync(fn) {
  _listeners.push(fn);
  fn({ ..._state });
  return () => { _listeners = _listeners.filter(f => f !== fn); };
}

async function drainQueue() {
  const items = await db.queue.toArray();
  for (const item of items) {
    try {
      await api.request({ method: item.method, url: item.url, data: item.data });
      await db.queue.delete(item.id);
      _state.pending = Math.max(0, _state.pending - 1);
    } catch (e) {
      if (e.response) {
        await db.queue.delete(item.id);
        _state.pending = Math.max(0, _state.pending - 1);
      }
    }
  }
  _state.lastSyncAt = new Date().toISOString();
  _state.pending = await db.queue.count();
  notify();
}

api.interceptors.response.use(
  r => { _state.lastSyncAt = new Date().toISOString(); notify(); return r; },
  async err => {
    if (!err.response && err.config &&
        ["post","patch","put","delete"].includes((err.config.method||"").toLowerCase())) {
      await db.queue.add({
        method: err.config.method, url: err.config.url,
        data: err.config.data, created_at: new Date().toISOString()
      });
      _state.pending = await db.queue.count();
      notify();
    }
    return Promise.reject(err);
  }
);

window.addEventListener("online", () => {
  _state.online = true; notify(); drainQueue();
});
window.addEventListener("offline", () => {
  _state.online = false; notify();
});

setInterval(async () => {
  if (_state.online) await drainQueue();
}, 20000);
