// Renders the real page builders in jsdom against realistic data. Verifies structure, filters, XSS-safety, theme toggle, reduced-motion fallbacks.
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { JSDOM } from "jsdom";

const html = '<!doctype html><html data-theme="dark" data-motion="on"><body><div id="app"></div><div id="toasts"></div></body></html>';
const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
const { window } = dom;
for (const k of ["window", "document", "Node", "HTMLElement", "Event", "SVGElement"]) globalThis[k] = k === "window" ? window : window[k];
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
globalThis.matchMedia = window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
globalThis.location = window.location; globalThis.sessionStorage = window.sessionStorage; globalThis.localStorage = window.localStorage;
globalThis.requestAnimationFrame = (f) => setTimeout(() => f(performance.now()), 0);
globalThis.window.PORTFOLIO_CONFIG = { apiBase: "" };

const SITE = {
  settings: {
    hero: { eyebrow: "// Portfolio", name: "Waheed Abbas", roles: ["Agentic AI Engineer", "ML Engineer"], headline: "Builds AI.", intro: "Intro text.", primary_cta_label: "View projects", facts: [{ label: "stack", value: "Python" }], profile_image_url: null },
    about: { paragraphs: ["About one", "About two"], highlights: [{ title: "Agentic AI", text: "LangGraph" }] }, availability: { state: "open", text: "Open to work" },
    services: { intro: "Services intro", items: [{ title: "Agents", description: "Build agents" }] }, contact: { email: "me@example.com", location: "PK", intro: "Hi", categories: ["Job opportunity", "General inquiry"] },
    social: { links: [{ label: "GitHub", url: "https://github.com/x" }, { label: "Evil", url: "javascript:alert(1)" }] }, footer: { tagline: "t" }, seo: { title: "T" },
    design: { default_theme: "system", accent: "cyan", animations_enabled: true, intensity: "medium", typing_effect: true, scroll_reveal: true, scene_3d: true, tilt_cards: true, project_layout: "grid" },
    sections: { about: true, skills: true, projects: true, experience: true, education: true, certifications: true, services: true, resume: true, contact: true }, resume: { cv_download_url: "https://example.com/cv.pdf" },
  },
  skills: { Programming: ["Python", "SQL"] }, items: { education: [{ title: "BS CS", organization: "GCUF", start: "", end: "2024", description: "", url: null }] },
  projects: [
    { slug: "alpha", title: "Alpha <img src=x onerror=alert(1)>", summary: "S1", category: "agentic-ai", status: "completed", tech: ["Python", "FastAPI"], featured: true, github_url: "https://github.com/x/alpha", live_url: null, image_url: null },
    { slug: "beta", title: "Beta", summary: "S2", category: "nlp-rag", status: "local-build", tech: [], featured: false, github_url: "javascript:alert(1)", live_url: null, image_url: null },
  ],
};
let pages, ctx;
before(async () => { pages = await import("../../public/js/pages.js"); ctx = { site: SITE, offline: false, refreshEffects() {} }; });

test("home page renders all sections with real data, in order", () => {
  const { el } = pages.homePage(ctx);
  assert.deepEqual([...el.querySelectorAll("section[id]")].map((s) => s.id), ["top", "about", "skills", "featured", "experience", "services", "resume", "contact"]);
  assert.match(el.querySelector("h1").textContent, /Waheed Abbas/);
  assert.ok(el.querySelector('a[href="https://example.com/cv.pdf"]'), "download CV button present");
  assert.equal(el.querySelectorAll(".pcard").length, 1, "home shows featured projects only");
  assert.ok([...el.querySelectorAll("a")].some((a) => /All 2 projects/.test(a.textContent)));
  assert.ok(el.querySelector("form"), "contact form present");
});

test("hidden sections are not rendered", () => {
  const c2 = { ...ctx, site: { ...SITE, settings: { ...SITE.settings, sections: { ...SITE.settings.sections, services: false, resume: false } } } };
  const ids = [...pages.homePage(c2).el.querySelectorAll("section[id]")].map((s) => s.id);
  assert.ok(!ids.includes("services") && !ids.includes("resume") && ids.includes("about"));
});

test("hostile project title and javascript: links are inert", () => {
  const { el } = pages.homePage(ctx);
  assert.equal(el.querySelectorAll("img[onerror]").length, 0);
  assert.ok(el.textContent.includes("<img src=x onerror=alert(1)>"), "shown as plain text");
  assert.equal([...el.querySelectorAll("a")].filter((a) => (a.getAttribute("href") || "").startsWith("javascript:")).length, 0);
});

test("projects page: filter pills work and update the count", () => {
  const { el } = pages.projectsPage(ctx);
  const pills = [...el.querySelectorAll(".pill")];
  assert.deepEqual(pills.map((p) => p.textContent), ["All", "Agentic AI", "NLP & RAG", "List view"]);
  assert.equal(el.querySelectorAll(".pcard").length, 2);
  pills[1].click();
  assert.equal(el.querySelectorAll(".pcard").length, 1); assert.match(el.querySelector("[role=status]").textContent, /1 project$/);
  assert.equal(pills[1].getAttribute("aria-pressed"), "true"); assert.equal(pills[0].getAttribute("aria-pressed"), "false");
  pills[3].click(); assert.ok(el.querySelector(".projects.list"));
});

test("offline mode swaps the contact form for a mailto fallback", () => {
  const { el } = pages.homePage({ ...ctx, offline: true });
  assert.equal(el.querySelector("form"), null); assert.ok(el.querySelector('a[href="mailto:me@example.com"]'));
});

test("contact form validates, shows accessible errors and does not submit invalid data", async () => {
  const { buildContactForm } = await import("../../public/js/contact.js");
  let called = false; window.fetch = globalThis.fetch = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  const form = buildContactForm(ctx); document.body.append(form);
  form.dispatchEvent(new window.Event("submit", { cancelable: true }));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(called, false);
  assert.match(document.getElementById("c-email-err").textContent, /valid email/);
  assert.equal(document.getElementById("c-email").getAttribute("aria-invalid"), "true");
  assert.ok(form.querySelector(".hp input[tabindex='-1']"), "honeypot present and hidden from tab order");
  assert.ok([...form.querySelectorAll("option")].some((o) => o.value === "Job opportunity"));
});

test("contact form success and server-failure states are honest", async () => {
  const { buildContactForm } = await import("../../public/js/contact.js");
  const fill = (f) => { f.querySelector("#c-name").value = "Ada"; f.querySelector("#c-email").value = "a@b.co"; f.querySelector("#c-category").value = "Job opportunity"; f.querySelector("#c-subject").value = "Hi"; f.querySelector("#c-message").value = "A long enough message here."; };
  let f = buildContactForm(ctx); fill(f); globalThis.fetch = async () => ({ ok: true, status: 201, json: async () => ({ status: "received" }) });
  f.dispatchEvent(new window.Event("submit", { cancelable: true })); await new Promise((r) => setTimeout(r, 20));
  assert.match(f.textContent, /saved/); assert.ok(!/email (was )?sent|delivered/i.test(f.textContent));
  f = buildContactForm(ctx); fill(f); globalThis.fetch = async () => { throw new TypeError("network"); };
  f.dispatchEvent(new window.Event("submit", { cancelable: true })); await new Promise((r) => setTimeout(r, 20));
  assert.match(f.querySelector(".alert.bad").textContent, /couldn't reach the server/);
  assert.equal(f.querySelector("button[type=submit]").disabled, false, "button re-enabled after failure");
});

test("theme: init script honours saved preference and system default", async () => {
  const fs = await import("node:fs"); const code = fs.readFileSync(new URL("../../public/js/theme-init.js", import.meta.url), "utf8");
  const run = (saved, prefersDark) => { const d = new JSDOM("<html></html>", { url: "http://localhost/", runScripts: "outside-only" }); d.window.matchMedia = () => ({ matches: prefersDark });
    if (saved) d.window.localStorage.setItem("pf_theme", saved); d.window.eval(code); return d.window.document.documentElement.getAttribute("data-theme"); };
  assert.equal(run(null, true), "dark"); assert.equal(run(null, false), "light"); assert.equal(run("light", true), "light"); assert.equal(run("dark", false), "dark");
});

test("css defines both themes, five accents and reduced-motion handling", async () => {
  const fs = await import("node:fs"); const t = fs.readFileSync(new URL("../../public/css/theme.css", import.meta.url), "utf8"), a = fs.readFileSync(new URL("../../public/css/app.css", import.meta.url), "utf8");
  assert.ok(t.includes("data-theme=dark") && t.includes("data-theme=light"));
  for (const acc of ["violet", "emerald", "amber", "rose"]) assert.ok(t.includes(`data-accent=${acc}`));
  assert.ok(a.includes("prefers-reduced-motion") && a.includes("data-motion=off") && a.includes(":focus-visible"));
});

test("no inline event handlers or inline scripts in served html (CSP-safe)", async () => {
  const fs = await import("node:fs");
  for (const f of ["public/index.html", "admin/index.html"]) { const s = fs.readFileSync(new URL(`../../${f}`, import.meta.url), "utf8"); assert.ok(!/\son\w+=/.test(s)); assert.ok(!/<script(?![^>]*src=)[^>]*>/.test(s)); }
});
