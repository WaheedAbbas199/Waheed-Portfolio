// Deployment config (no secrets).
// apiBase: ""  -> same origin (backend serves this site) OR static-only hosting (site shows its bundled content; contact form falls back to email).
// apiBase: "https://your-backend.example.com" -> static site + separate backend (chatbot and contact form go live).
window.PORTFOLIO_CONFIG = { apiBase: "" };
