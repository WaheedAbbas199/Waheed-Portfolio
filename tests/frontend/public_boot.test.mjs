// Boots the REAL public app (main.js) in jsdom: header, theme toggle, routing, chatbot widget. Catches load-time crashes.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const SITE = {
  settings: {
    hero: { eyebrow: "// Portfolio", name: "Waheed Abbas", roles: ["Agentic AI Engineer"], headline: "Builds AI.", intro: "Intro.", primary_cta_label: "View projects", facts: [{ label: "stack", value: "Python" }], profile_image_url: null },
    about: { paragraphs: ["About"], highlights: [{ title: "T", text: "x" }] }, availability: { state: "open", text: "Open to work" }, services: { intro: "i", items: [{ title: "S", description: "d" }] },
    contact: { email: "me@example.com", location: "PK", intro: "Hi", categories: ["General inquiry"] }, social: { links: [{ label: "GitHub", url: "https://github.com/x" }] }, footer: { tagline: "t" }, seo: { title: "Waheed — AI" },
    design: { default_theme: "system", accent: "violet", animations_enabled: true, intensity: "medium", typing_effect: true, scroll_reveal: true, scene_3d: false, tilt_cards: true, project_layout: "grid" },
    sections: { about: true, skills: true, projects: true, experience: true, education: true, certifications: true, services: true, resume: true, contact: true }, resume: { cv_download_url: null },
  },
  skills: { Programming: ["Python"] }, items: {}, projects: [{ slug: "alpha", title: "Alpha", summary: "S", category: "agentic-ai", status: "completed", tech: ["Python"], featured: true, github_url: null, live_url: null, image_url: null }],
};
const CHAT = { enabled: true, welcome: "Hi, ask me anything.", suggested: ["Who is Waheed?"], languages: ["en", "ur"], voice_output_default: false, daily_limit: 500, ai_available: false };

test("public app boots: header, nav, theme toggle, routing and chat widget all work", async () => {
  const dom = new JSDOM('<!doctype html><html data-theme="dark" data-motion="on"><head><meta name="theme-color" content="#000"></head><body><canvas id="scene"></canvas><div id="app"></div></body></html>', { url: "http://localhost/", pretendToBeVisual: true });
  const w = dom.window;
  for (const k of ["window", "document", "Node", "HTMLElement", "Event", "SVGElement"]) globalThis[k] = k === "window" ? w : w[k];
  Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true });
  w.matchMedia = globalThis.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
  for (const k of ["location", "localStorage", "sessionStorage", "addEventListener", "removeEventListener", "scrollTo", "getComputedStyle"]) globalThis[k] = typeof w[k] === "function" ? w[k].bind(w) : w[k];
  Object.defineProperty(globalThis, "scrollY", { get: () => 0, configurable: true }); Object.defineProperty(globalThis, "innerWidth", { value: 1200, configurable: true });
  globalThis.requestAnimationFrame = (f) => setTimeout(() => f(performance.now()), 0); w.Element.prototype.scrollIntoView = function () {};
  w.PORTFOLIO_CONFIG = globalThis.PORTFOLIO_CONFIG = { apiBase: "" };
  const errors = []; globalThis.onerror = (e) => errors.push(e); process.on("unhandledRejection", (e) => errors.push(e));
  globalThis.fetch = async (url) => { const u = String(url); const body = u.includes("/public/site") ? SITE : u.includes("/public/chat/config") ? CHAT : null; return { ok: !!body, status: body ? 200 : 404, json: async () => body }; };

  await import("../../public/js/main.js"); await new Promise((r) => setTimeout(r, 450));
  const doc = w.document;
  assert.ok(doc.querySelector("header.header"), "header rendered"); assert.match(doc.querySelector("h1").textContent, /Waheed Abbas/);
  assert.equal(doc.documentElement.getAttribute("data-accent"), "violet", "admin accent applied");
  assert.ok(doc.querySelector(".theme-toggle"), "theme toggle in header");
  const before = doc.documentElement.getAttribute("data-theme"); doc.querySelector(".theme-toggle").click();
  const after = doc.documentElement.getAttribute("data-theme"); assert.notEqual(before, after); assert.equal(w.localStorage.getItem("pf_theme"), after);
  doc.querySelector(".theme-toggle").click(); assert.equal(doc.documentElement.getAttribute("data-theme"), before);
  assert.ok(doc.querySelector(".chat-fab"), "chat button present"); doc.querySelector(".chat-fab").click();
  assert.equal(doc.querySelector(".chat").hidden, false); assert.match(doc.querySelector(".chat").textContent, /Hi, ask me anything/);
  assert.ok(doc.querySelector(".chat .mini[aria-label='Start voice input']").disabled, "mic disabled (graceful fallback) when speech API missing");
  w.location.hash = "#/projects"; w.dispatchEvent(new w.Event("hashchange")); await new Promise((r) => setTimeout(r, 700));
  assert.ok(doc.querySelector(".projects .pcard"), "projects page rendered"); assert.match(doc.title, /Projects/);
  w.location.hash = "#/project/alpha"; w.dispatchEvent(new w.Event("hashchange")); await new Promise((r) => setTimeout(r, 700));
  assert.ok(doc.querySelector(".back"), "project page navigated");
  assert.deepEqual(errors, [], "no uncaught errors");
});
