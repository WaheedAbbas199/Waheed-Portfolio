import { h, icon, clear } from "./dom.js";
import { API_BASE, getSite, mediaUrl } from "./api.js";
import { parseRoute, safeHref } from "./util.js";
import { homePage, projectPage, projectsPage } from "./pages.js";
import { initCardEffects, initMagnetic, initReveal, motionOn, typeRoles } from "./effects.js";
import { offlineNotice } from "./components.js";
import { initChat } from "./chat.js";

const root = document.documentElement;
const app = document.getElementById("app");
const NAV = [["about", "About"], ["skills", "Skills"], ["featured", "Projects"], ["experience", "Experience"], ["services", "Services"], ["contact", "Contact"]];
const ctx = { site: null, offline: false, staticOnly: false, scene: null, refreshEffects: () => {} };
let stopTyping = () => {}; let stopReveal = () => {}; let currentRoute = null; let navEl, headerEl, mainEl, sectionObserver;

// ---------- theme ----------
const prefersDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
function setTheme(theme, persist = true) {
  root.classList.add("theme-anim"); root.setAttribute("data-theme", theme);
  if (persist) { try { localStorage.setItem("pf_theme", theme); } catch { /* private mode */ } }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#05070f" : "#f2f5fb");
  ctx.scene?.refreshColors(); setTimeout(() => root.classList.remove("theme-anim"), 700);
}
const themeToggle = () => h("button", { class: "icon-btn theme-toggle", type: "button", "aria-label": "Toggle dark and light mode", title: "Toggle theme", "aria-pressed": String(root.getAttribute("data-theme") === "dark"),
  onclick: (e) => { const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark"; setTheme(next); e.currentTarget.setAttribute("aria-pressed", String(next === "dark")); } },
  h("span", { class: "sun", style: null }, icon("sun")), h("span", { class: "moon", style: null }, icon("moon")));
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => { if (!localStorage.getItem("pf_theme")) setTheme(e.matches ? "dark" : "light", false); });

function applyDesign(d) {
  root.setAttribute("data-accent", d.accent); root.setAttribute("data-intensity", d.intensity);
  try { localStorage.setItem("pf_accent_cache", d.accent); } catch { /* ignore */ }
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.setAttribute("data-motion", d.animations_enabled && !reduced ? "on" : "off");
  if (!localStorage.getItem("pf_theme") && d.default_theme !== "system") setTheme(d.default_theme, false);
}

// ---------- shell ----------
function buildShell(st) {
  const cv = st.resume.cv_download_url; const avail = st.availability;
  navEl = h("nav", { class: "nav", id: "nav", "aria-label": "Primary" }, NAV.filter(([id]) => st.sections[{ featured: "projects" }[id] || id] !== false).map(([id, label]) => h("a", { href: `#/${id}`, "data-sec": id }, label)));
  const burger = h("button", { class: "icon-btn burger", type: "button", "aria-label": "Open menu", "aria-expanded": "false", "aria-controls": "nav", onclick: (e) => {
    const open = navEl.classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", String(open)); e.currentTarget.replaceChildren(icon(open ? "close" : "menu")); } }, icon("menu"));
  navEl.addEventListener("click", (e) => { if (e.target.closest("a")) { navEl.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); burger.replaceChildren(icon("menu")); } });
  headerEl = h("header", { class: "header" }, h("div", { class: "wrap" },
    h("a", { class: "logo", href: "#/", "aria-label": `${st.hero.name} — home` }, h("i", {}, "//"), st.hero.name.split(" ")[0]), navEl,
    h("div", { class: "hdr-actions" }, h("span", { class: `avail ${avail.state}`, title: "Availability" }, h("i"), avail.text),
      cv ? h("a", { class: "btn sm", href: mediaUrl(cv), target: "_blank", rel: "noopener noreferrer" }, "CV", icon("download", 15)) : null, themeToggle(), burger)));
  addEventListener("scroll", () => headerEl.classList.toggle("scrolled", scrollY > 24), { passive: true });
  mainEl = h("main", { id: "main", tabindex: "-1" });
  const soc = st.social.links.map((l) => { const href = safeHref(l.url); return href ? h("li", {}, h("a", { href, target: "_blank", rel: "noopener noreferrer" }, l.label)) : null; });
  const footer = h("footer", { class: "footer" }, h("div", { class: "wrap" },
    h("div", {}, h("a", { class: "logo", href: "#/" }, h("i", {}, "//"), st.hero.name), h("p", { class: "muted", style: null }, st.footer.tagline)),
    h("div", {}, h("h4", {}, "Navigate"), h("ul", {}, NAV.map(([id, label]) => h("li", {}, h("a", { href: `#/${id}` }, label))), h("li", {}, h("a", { href: "#/projects" }, "All projects")))),
    h("div", {}, h("h4", {}, "Elsewhere"), h("ul", {}, soc, st.contact.email ? h("li", {}, h("a", { href: `mailto:${st.contact.email}` }, "Email")) : null, h("li", {}, h("a", { href: "#/contact" }, "Contact form")))),
    h("div", { class: "copy" }, h("span", {}, `© ${new Date().getFullYear()} ${st.hero.name}. All rights reserved.`), h("span", { class: "mono" }, "Built with FastAPI · three.js"))));
  clear(app).append(h("a", { class: "skip", href: "#main" }, "Skip to content"), ctx.offline && !ctx.staticOnly ? offlineNotice() : null, headerEl, mainEl, footer);
}

// ---------- routing ----------
function observeSections() {
  sectionObserver?.disconnect();
  if (!("IntersectionObserver" in window)) return;
  sectionObserver = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id); }), { rootMargin: "-45% 0px -50% 0px" });
  mainEl.querySelectorAll("section[id]").forEach((s) => sectionObserver.observe(s));
}
function setActive(id) { navEl.querySelectorAll("a").forEach((a) => a.setAttribute("aria-current", String(a.dataset.sec === id))); }

async function render() {
  const r = parseRoute(location.hash); const key = r.page === "home" ? "home" : r.page === "projects" ? "projects" : `project:${r.slug}`;
  const sameHome = currentRoute === "home" && key === "home";
  if (sameHome) { scrollToSection(r.section); return; }
  stopTyping(); stopReveal(); currentRoute = key;
  const old = mainEl.firstElementChild;
  if (old && motionOn()) { old.classList.add("leaving"); await new Promise((res) => setTimeout(res, 260)); }
  let view;
  if (r.page === "home") view = homePage(ctx); else if (r.page === "projects") view = projectsPage(ctx); else view = await projectPage(ctx, r.slug);
  clear(mainEl).append(view.el);
  document.title = r.page === "project" && view.title ? `${view.title} — ${ctx.site.settings.hero.name}` : r.page === "projects" ? `Projects — ${ctx.site.settings.hero.name}` : ctx.site.settings.seo.title;
  ctx.scene?.setRoute(r.page);
  ctx.refreshEffects(view.el);
  if (view.roles) stopTyping = typeRoles(view.roles, ctx.site.settings.hero.roles, { enabled: ctx.site.settings.design.typing_effect });
  observeSections(); setActive(r.page === "projects" || r.page === "project" ? "featured" : r.section || "");
  r.page === "home" && r.section ? requestAnimationFrame(() => scrollToSection(r.section, true)) : scrollTo({ top: 0, behavior: "instant" });
  if (r.page !== "home") mainEl.focus({ preventScroll: true });
}
function scrollToSection(id, instant = false) {
  const el = id ? document.getElementById(id) : document.getElementById("top");
  if (el) el.scrollIntoView({ behavior: instant || !motionOn() ? "auto" : "smooth", block: "start" });
}

// ---------- boot ----------
async function boot() {
  app.append(h("div", { class: "wrap", style: null }, h("div", { class: "skeleton", style: null })));
  try {
    const { data, offline } = await getSite(); ctx.site = data; ctx.offline = offline; ctx.staticOnly = offline && !API_BASE; // static hosting without a backend is a normal mode, not an error
  } catch { clear(app).append(h("div", { class: "wrap", style: null }, h("h1", {}, "Site is temporarily unavailable"), h("p", { class: "muted" }, "Please try again in a moment."))); return; }
  const st = ctx.site.settings; applyDesign(st.design);
  ctx.refreshEffects = (el) => {
    stopReveal = initReveal(el, st.design.scroll_reveal); initMagnetic(el);
    if (!el.dataset.fx) { el.dataset.fx = "1"; initCardEffects(el, { tilt: st.design.tilt_cards, strength: { low: 0.5, medium: 1, high: 1.4 }[st.design.intensity] }); }
  };
  buildShell(st); window.addEventListener("hashchange", render); await render();
  initChat(app, ctx);
  // 3D scene: lazy, after first paint, only where it makes sense.
  const canvas = document.getElementById("scene");
  if (st.design.scene_3d && st.design.animations_enabled) {
    const start = async () => {
      const { canRun3D, initScene } = await import("./scene.js");
      if (!canRun3D()) return;
      try { ctx.scene = await initScene(canvas, { intensity: st.design.intensity }); if (ctx.scene) { canvas.classList.add("ready"); ctx.scene.setRoute(parseRoute(location.hash).page); } } catch { /* fall back to CSS backdrop */ }
    };
    "requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 800);
  }
}
boot();
