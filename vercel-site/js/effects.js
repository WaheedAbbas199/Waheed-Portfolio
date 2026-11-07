// Lightweight interaction effects. Everything degrades to static when motion is off or on touch devices.
import { clamp } from "./util.js";

export const motionOn = () => document.documentElement.getAttribute("data-motion") !== "off";
const fine = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

export function initReveal(root, enabled = true) {
  const els = [...root.querySelectorAll(".reveal")];
  if (!enabled || !motionOn() || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return () => {}; }
  els.forEach((el, i) => { if (!el.style.getPropertyValue("--d")) el.style.setProperty("--d", String(i % 6)); });
  const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  els.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

// Cards: spotlight follows the cursor everywhere; 3D tilt only on .tilt when allowed.
export function initCardEffects(root, { tilt = true, strength = 1 } = {}) {
  if (!fine() || !motionOn()) return;
  const max = 9 * strength;
  root.addEventListener("pointermove", (e) => {
    const card = e.target.closest?.(".card"); if (!card) return;
    const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.style.setProperty("--mx", `${x * 100}%`); card.style.setProperty("--my", `${y * 100}%`);
    const t = card.closest(".tilt") || (card.classList.contains("tilt") ? card : null);
    if (tilt && t) { t.classList.add("moving"); t.style.setProperty("--ry", `${clamp((x - 0.5) * 2 * max, -max, max)}deg`); t.style.setProperty("--rx", `${clamp(-(y - 0.5) * 2 * max, -max, max)}deg`); }
  });
  root.addEventListener("pointerout", (e) => { const t = e.target.closest?.(".tilt"); if (t && !t.contains(e.relatedTarget)) { t.classList.remove("moving"); t.style.setProperty("--rx", "0deg"); t.style.setProperty("--ry", "0deg"); } });
}

export function initMagnetic(root) {
  if (!fine() || !motionOn()) return;
  root.querySelectorAll(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (e) => { const r = el.getBoundingClientRect(); el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.25}px)`; });
    el.addEventListener("pointerleave", () => { el.style.transform = ""; });
  });
}

export function typeRoles(el, roles, { enabled = true } = {}) {
  if (!roles.length) return () => {};
  el.textContent = roles[0];
  if (!enabled || !motionOn()) return () => {};
  let stop = false, i = 0;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  (async () => {
    await wait(1800);
    while (!stop) {
      const word = roles[i % roles.length];
      for (let n = word.length; n >= 0 && !stop; n--) { el.textContent = word.slice(0, n); await wait(28); }
      i++; const next = roles[i % roles.length];
      for (let n = 1; n <= next.length && !stop; n++) { el.textContent = next.slice(0, n); await wait(55); }
      await wait(2200);
    }
  })();
  return () => { stop = true; };
}

export function countUp(el, target) {
  if (!motionOn()) { el.textContent = String(target); return; }
  const start = performance.now(), dur = 1100;
  const step = (now) => { const p = clamp((now - start) / dur, 0, 1); el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

export function onceVisible(el, fn) {
  if (!("IntersectionObserver" in window)) return fn();
  const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold: 0.4 }); io.observe(el);
}
