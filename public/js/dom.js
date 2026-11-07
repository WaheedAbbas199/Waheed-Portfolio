// Tiny DOM builder. Values are always inserted as text nodes (never innerHTML) so admin/visitor content cannot inject markup.
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "vars") Object.entries(v).forEach(([n, val]) => el.style.setProperty(n, val));
    else if (k === "value" || k === "checked" || k === "disabled" || k === "hidden" || k === "selected") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  add(el, kids);
  return el;
}
function add(el, kids) { for (const c of kids.flat(Infinity)) { if (c === null || c === undefined || c === false) continue; el.append(c instanceof Node ? c : document.createTextNode(String(c))); } }
const NS = "http://www.w3.org/2000/svg";
export function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  add(el, kids);
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

const P = {
  sun: "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z",
  moon: "M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z",
  menu: "M4 7h16M4 12h16M4 17h16", close: "M6 6l12 12M18 6L6 18",
  github: "M9 19c-4 1.5-4-2-6-2m12 4v-3.5c0-1 .1-1.4-.5-2 2.800-.3 5.500-1.400 5.500-6a4.600 4.600 0 00-1.300-3.200 4.200 4.200 0 00-.1-3.200s-1.100-.3-3.500 1.300a12 12 0 00-6.200 0C6.500 2.800 5.400 3.100 5.400 3.100a4.200 4.200 0 00-.1 3.200A4.600 4.600 0 004 9.500c0 4.600 2.700 5.700 5.500 6-.6.600-.6 1.200-.5 2V21",
  linkedin: "M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 2a2 2 0 110 4 2 2 0 010-4z",
  mail: "M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6",
  arrow: "M5 12h14M13 6l6 6-6 6", ext: "M7 17L17 7M8 7h9v9", download: "M12 3v12m0 0l-4-4m4 4l4-4M4 21h16",
  mic: "M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3zM19 11a7 7 0 01-14 0M12 18v4M8 22h8",
  speaker: "M11 5L6 9H2v6h4l5 4V5zM15.500 8.500a5 5 0 010 7M18.500 5.500a9 9 0 010 13",
  stop: "M6 6h12v12H6z", copy: "M9 9h11v11H9zM5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z", chat: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  refresh: "M3 12a9 9 0 0115-6.700L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.700L3 16M3 21v-5h5", trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  check: "M5 13l4 4L19 7", spark: "M12 2l2.400 7.600L22 12l-7.600 2.400L12 22l-2.400-7.600L2 12l7.600-2.400z",
};
export function icon(name, size = 20) {
  return s("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false", class: "icon" },
    s("path", { d: P[name] || "" }));
}
