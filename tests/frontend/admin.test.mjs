// Loads the REAL admin app in jsdom and visits every page with mocked API data. Guards against load-time crashes (blank admin page).
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const MEDIA = [{ id: "m1", url: "/media/a.png", name: "a.png", mime: "image/png", kind: "image", size: 2048, created_at: "2026-01-01T00:00:00Z" }];
const PROJECT = { id: "p1", slug: "demo", title: "Demo", summary: "s", problem: "", solution: "", features: [], tech: ["Python"], architecture: "", challenges: "", results: "", category: "agentic-ai", status: "completed", github_url: null, live_url: null, image_id: null, featured: true, sort_order: 0, published: true };
const SETTINGS = { hero: { eyebrow: "// P", name: "W", roles: ["a"], headline: "h", intro: "i", primary_cta_label: "go", facts: [{ label: "l", value: "v" }], profile_image_id: null }, about: { paragraphs: ["x"], highlights: [{ title: "t", text: "x" }] },
  availability: { state: "open", text: "open" }, services: { intro: "i", items: [{ title: "t", description: "d" }] }, contact: { email: "a@b.co", location: "PK", intro: "", categories: ["General inquiry"] }, social: { links: [{ label: "GitHub", url: "https://github.com/x" }] },
  footer: { tagline: "t" }, seo: { title: "t", description: "d", keywords: "k", og_image_id: null }, resume: { cv_media_id: null, cv_url: "" },
  sections: { about: true, skills: true, projects: true, experience: true, education: true, certifications: true, services: true, resume: true, contact: true },
  design: { default_theme: "system", accent: "cyan", animations_enabled: true, intensity: "medium", typing_effect: true, scroll_reveal: true, scene_3d: true, tilt_cards: true, project_layout: "grid" },
  chatbot: { enabled: true, welcome: "hi", suggested: ["q"], languages: ["en"], voice_output_default: false, daily_limit: 500 }, email: { notify_to: "a@b.co", sender_name: "P", subject_prefix: "[P]", send_confirmation: false } };
const DASH = { projects_published: 1, projects_draft: 0, messages_total: 1, messages_unread: 1, email_failed: 0, chat_7d: 2, chat_30d: 3, chat_errors_30d: 0, chat_basic_30d: 1, config: { ai_configured: false, email_provider: "disabled", email_configured: false }, recent_activity: [{ action: "auth.login", entity: "admin", at: "2026-01-01T00:00:00Z" }] };
const MSG = { id: "g1", name: "Ada", email: "ada@example.com", category: "General inquiry", subject: "Hi", message: "Hello there friend", status: "unread", email_status: "failed", confirmation_status: "disabled", created_at: "2026-01-01T00:00:00Z" };

function route(path) {
  const p = path.replace("/api/v1/admin", "").split("?")[0];
  if (p === "/auth/me") return { email: "owner@example.com", csrf: "tok" };
  if (p === "/dashboard") return DASH;
  if (p === "/settings") return SETTINGS;
  if (p === "/projects") return [PROJECT];
  if (p === "/skills") return [{ id: "s1", category: "Tools", name: "Git", sort_order: 0, published: true }];
  if (p === "/items") return [{ id: "i1", kind: "education", title: "BS", organization: "U", start_date: "", end_date: "2024", description: "", url: null, sort_order: 0, published: true }];
  if (p === "/media") return MEDIA;
  if (p === "/messages") return { total: 1, page: 1, page_size: 20, items: [MSG] };
  if (p === "/audit") return { total: 1, items: [{ action: "x", entity_type: "y", entity_id: "1", details: {}, at: "2026-01-01T00:00:00Z" }] };
  throw new Error(`unmocked ${path}`);
}

async function boot(loggedIn) {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div><div id="toasts"></div></body></html>', { url: "http://localhost/admin" });
  for (const k of ["window", "document", "Node", "HTMLElement", "Event", "FormData"]) globalThis[k] = k === "window" ? dom.window : dom.window[k];
  globalThis.location = dom.window.location;
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(url); if (!loggedIn) return { status: 401, ok: false, json: async () => ({ error: { message: "Authentication required" } }) }; return { status: 200, ok: true, json: async () => route(url) }; };
  await import(`../../admin/js/app.js?${Math.random()}`);
  await new Promise((r) => setTimeout(r, 60));
  return { dom, calls };
}

test("admin loads without crashing and shows the login form when signed out", async () => {
  const { dom } = await boot(false);
  const doc = dom.window.document;
  assert.ok(doc.querySelector("form input[type=email]") && doc.querySelector("form input[type=password]"), "login form rendered");
  assert.match(doc.body.textContent, /Admin sign in/); assert.match(doc.body.textContent, /no public registration/i);
});

test("every admin page renders with data (no blank pages)", async () => {
  const { dom } = await boot(true);
  const doc = dom.window.document; const w = dom.window;
  assert.equal([...doc.querySelectorAll("a.nav")].length, 11, "all 11 menu items");
  for (const page of ["dashboard", "projects", "content", "skills", "items", "design", "media", "messages", "chatbot", "email", "audit"]) {
    w.location.hash = `#/${page}`; w.dispatchEvent(new w.Event("hashchange")); await new Promise((r) => setTimeout(r, 60));
    const main = doc.querySelector("main.main");
    assert.ok(main && main.textContent.trim().length > 20, `page "${page}" is not blank`);
    assert.ok(!/Cannot|undefined is not|ReferenceError/.test(main.textContent), `page "${page}" shows no error: ${main.textContent.slice(0, 80)}`);
  }
  w.location.hash = "#/projects"; w.dispatchEvent(new w.Event("hashchange")); await new Promise((r) => setTimeout(r, 60));
  assert.match(doc.querySelector("main.main").textContent, /Demo/); assert.ok([...doc.querySelectorAll("button")].some((b) => b.textContent === "New project"));
  w.location.hash = "#/dashboard"; w.dispatchEvent(new w.Event("hashchange")); await new Promise((r) => setTimeout(r, 60));
  assert.match(doc.querySelector("main.main").textContent, /Published projects/);
});
