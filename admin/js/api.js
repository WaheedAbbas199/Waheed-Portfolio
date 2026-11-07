export const state = { csrf: null, user: null };
export class ApiError extends Error { constructor(status, body) { super(body?.error?.message || `Request failed (${status})`); this.status = status; this.details = body?.error?.details; } }
let onAuthLost = () => {};
export const setAuthLostHandler = (f) => { onAuthLost = f; };
export async function api(path, { method = "GET", body, form } = {}) {
  const headers = {};
  if (method !== "GET") headers["X-CSRF-Token"] = state.csrf || "";
  let payload; if (form) payload = form; else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch(`/api/v1/admin${path}`, { method, headers, body: payload, credentials: "same-origin" });
  if (res.status === 204) return null;
  let data = null; try { data = await res.json(); } catch { /* none */ }
  if (res.status === 401 && !path.startsWith("/auth/login")) onAuthLost();
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
export const qs = (o) => { const p = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") p.set(k, v); }); const s = p.toString(); return s ? `?${s}` : ""; };
