const BASE = (window.PORTFOLIO_CONFIG?.apiBase || "").replace(/\/$/, "");
export const API_BASE = BASE;
export class ApiError extends Error {
  constructor(status, body, network = false) {
    super(body?.error?.message || (network ? "Can't reach the server right now." : `Request failed (${status})`));
    this.status = status; this.details = body?.error?.details; this.network = network;
  }
}
async function request(path, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeout || 20000);
  try {
    const res = await fetch(`${BASE}/api/v1${path}`, { ...opts, signal: ctl.signal, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
    let body = null; try { body = await res.json(); } catch { /* empty */ }
    if (!res.ok) throw new ApiError(res.status, body);
    return body;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, null, true);
  } finally { clearTimeout(timer); }
}
// Live API first. If it is missing (static hosting answers 404), asleep, unreachable or returns something that isn't our JSON,
// fall back to the snapshot shipped with the site (data/site.json) so the page ALWAYS renders.
export const getSite = async () => {
  try {
    const data = await request("/public/site");
    if (!data?.settings) throw new ApiError(0, null, true);
    return { data, offline: false };
  } catch (e) {
    try {
      const res = await fetch("/data/site.json", { cache: "no-cache" });
      if (res.ok) { const data = await res.json(); if (data?.settings) return { data, offline: true }; }
    } catch { /* no snapshot either */ }
    throw e;
  }
};
export const getProject = (slug) => request(`/public/projects/${encodeURIComponent(slug)}`);
export const getChatConfig = () => request("/public/chat/config");
export const sendChat = (message, history) => request("/public/chat", { method: "POST", body: JSON.stringify({ message, history }), timeout: 45000 });
export const sendContact = (payload) => request("/public/contact", { method: "POST", body: JSON.stringify(payload) });
// Uploaded files live behind the API host; bundled assets (e.g. /assets/...) stay on this site.
export const mediaUrl = (u) => (u && u.startsWith("/media/") ? BASE + u : u);
