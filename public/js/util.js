// Pure helpers (no DOM) so they can be unit-tested with node --test.
export const hashString = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export const CATEGORY_LABELS = {
  "agentic-ai": "Agentic AI", "machine-learning": "Machine Learning", "deep-learning": "Deep Learning", "nlp-rag": "NLP & RAG",
  "computer-vision": "Computer Vision", "data-science": "Data Science", "backend-apis": "Backend & APIs",
};
export const STATUS_LABELS = { "in-development": "In development", "local-build": "Local build", completed: "Completed", deployed: "Deployed", archived: "Archived" };

export function projectCategories(projects) {
  const seen = [];
  for (const p of projects) if (!seen.includes(p.category)) seen.push(p.category);
  return seen.map((id) => ({ id, label: CATEGORY_LABELS[id] || id }));
}
export const filterProjects = (projects, category) => (!category || category === "all" ? projects : projects.filter((p) => p.category === category));

export function parseRoute(hash) {
  const clean = (hash || "").replace(/^#\/?/, "").split("?")[0];
  const [first = "", second = ""] = clean.split("/");
  if (first === "projects") return { page: "projects" };
  if (first === "project" && second) return { page: "project", slug: decodeURIComponent(second) };
  if (["about", "skills", "featured", "experience", "services", "resume", "contact"].includes(first)) return { page: "home", section: first };
  return { page: "home", section: "" };
}

export function trimHistory(history, max = 6) {
  return history.filter((t) => (t.role === "user" || t.role === "assistant") && t.content).slice(-max).map((t) => ({ role: t.role, content: String(t.content).slice(0, 600) }));
}

export function speechSupport(win) {
  return { recognition: Boolean(win && (win.SpeechRecognition || win.webkitSpeechRecognition)), synthesis: Boolean(win && win.speechSynthesis && win.SpeechSynthesisUtterance) };
}
export const speechLang = (code) => ({ en: "en-US", ur: "ur-PK", "roman-ur": "en-US" }[code] || "en-US");

export function safeHref(url) {
  try { const u = new URL(url, "https://x.invalid"); return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:" ? url : null; } catch { return null; }
}
export const formatPeriod = (start, end) => [start, end].filter(Boolean).join(" – ") || "";
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const validateContact = (v) => {
  const errors = {};
  if (!v.name?.trim()) errors.name = "Please enter your name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email || "")) errors.email = "Please enter a valid email address.";
  if (!v.category) errors.category = "Please choose a category.";
  if (!v.subject?.trim()) errors.subject = "Please add a subject.";
  if ((v.message || "").trim().length < 10) errors.message = "Your message should be at least 10 characters.";
  if ((v.message || "").length > 4000) errors.message = "Your message is too long (max 4000 characters).";
  return errors;
};
