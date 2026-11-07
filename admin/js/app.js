import { ApiError, api, qs, setAuthLostHandler, state } from "./api.js";
import { buildForm, clear, confirmBox, fmt, h, modal, toast } from "./ui.js";

const root = document.getElementById("app");
const PROJECT_CATS = [["agentic-ai", "Agentic AI"], ["machine-learning", "Machine Learning"], ["deep-learning", "Deep Learning"], ["nlp-rag", "NLP & RAG"], ["computer-vision", "Computer Vision"], ["data-science", "Data Science"], ["backend-apis", "Backend & APIs"]];
const STATUSES = [["in-development", "In development"], ["local-build", "Local build"], ["completed", "Completed"], ["deployed", "Deployed"], ["archived", "Archived"]];
const T = (key, label, extra = {}) => ({ key, label, type: "text", ...extra });
const TA = (key, label, extra = {}) => ({ key, label, type: "textarea", ...extra });
const B = (key, label) => ({ key, label, type: "bool" });
const SCHEMAS = {
  hero: [T("eyebrow", "Eyebrow"), T("name", "Name"), { key: "roles", label: "Rotating roles (typing effect)", type: "list" }, T("headline", "Headline"), TA("intro", "Intro"), T("primary_cta_label", "Primary button label"),
    { key: "facts", label: "Hero fact chips", type: "objlist", fields: [T("label", "Label"), T("value", "Value")] }, { key: "profile_image_id", label: "Profile image", type: "media" }],
  about: [{ key: "paragraphs", label: "Paragraphs (one per line)", type: "list" }, { key: "highlights", label: "Highlights", type: "objlist", fields: [T("title", "Title"), TA("text", "Text")] }],
  availability: [{ key: "state", label: "Status", type: "select", options: ["open", "limited", "closed"] }, T("text", "Text shown in the header")],
  services: [TA("intro", "Intro"), { key: "items", label: "Services", type: "objlist", fields: [T("title", "Title"), TA("description", "Description")] }],
  contact: [T("email", "Public email"), T("location", "Location"), TA("intro", "Intro"), { key: "categories", label: "Inquiry categories", type: "list" }],
  social: [{ key: "links", label: "Links", type: "objlist", fields: [T("label", "Label"), T("url", "URL (https://…)")] }],
  footer: [T("tagline", "Tagline")],
  seo: [T("title", "Page title (≤70)"), TA("description", "Meta description (≤200)"), T("keywords", "Keywords"), { key: "og_image_id", label: "Social share image", type: "media" }],
  resume: [{ key: "cv_media_id", label: "CV (uploaded PDF)", type: "media", mediaKind: "cv" }, T("cv_url", "…or external CV URL (fallback)")],
  sections: ["about", "skills", "projects", "experience", "education", "certifications", "services", "resume", "contact"].map((k) => B(k, `Show “${k}” section`)),
  design: [{ key: "default_theme", label: "Default theme", type: "select", options: ["system", "light", "dark"] }, { key: "accent", label: "Accent colour", type: "select", options: ["cyan", "violet", "emerald", "amber", "rose"] },
    B("animations_enabled", "Enable animations"), { key: "intensity", label: "Animation intensity", type: "select", options: ["low", "medium", "high"] }, B("typing_effect", "Typing effect in hero"), B("scroll_reveal", "Scroll reveal"),
    B("scene_3d", "3D background scene"), B("tilt_cards", "3D tilt on cards"), { key: "project_layout", label: "Project layout", type: "select", options: ["grid", "list"] }],
  chatbot: [B("enabled", "Chatbot enabled"), TA("welcome", "Welcome message"), { key: "suggested", label: "Suggested questions", type: "list" }, { key: "languages", label: "Voice languages (en, ur, roman-ur)", type: "list" },
    B("voice_output_default", "Voice output on by default"), { key: "daily_limit", label: "Daily request limit (0 = unlimited)", type: "number" }],
  email: [T("notify_to", "Notification recipient"), T("sender_name", "Sender name"), T("subject_prefix", "Subject prefix"), B("send_confirmation", "Send a confirmation email to visitors")],
};
const PROJECT_SCHEMA = [T("title", "Title"), T("slug", "Slug", { hint: "lowercase-with-hyphens" }), TA("summary", "Short description"), { key: "category", label: "Category", type: "select", options: PROJECT_CATS },
  { key: "status", label: "Status", type: "select", options: STATUSES }, T("github_url", "GitHub URL"), T("live_url", "Live demo URL"), { key: "image_id", label: "Thumbnail", type: "media" },
  { key: "tech", label: "Technology tags", type: "list" }, { key: "features", label: "Key features", type: "list" }, TA("problem", "Problem statement"), TA("solution", "Solution"), TA("architecture", "Architecture overview"),
  TA("challenges", "Challenges & solutions"), TA("results", "Results", { hint: "verified results ONLY" }), B("featured", "Featured on home"), B("published", "Published (visible to the public)")];
const SKILL_SCHEMA = [T("category", "Category"), T("name", "Skill"), B("published", "Visible")];
const ITEM_SCHEMA = [{ key: "kind", label: "Type", type: "select", options: ["experience", "education", "certification", "achievement"] }, T("title", "Title"), T("organization", "Organization / issuer"), T("start_date", "Start / date"),
  T("end_date", "End"), TA("description", "Description"), T("url", "Verification / link URL"), B("published", "Published")];

const NAV = [["dashboard", "Dashboard"], ["projects", "Projects"], ["content", "Website content"], ["skills", "Skills"], ["items", "Experience & credentials"], ["design", "Design & animation"], ["media", "Media library"], ["messages", "Messages"], ["chatbot", "Chatbot"], ["email", "Email & site"], ["audit", "Audit history"]];
const fail = (e) => toast(e instanceof ApiError ? e.message : "Something went wrong", "error");
let mediaCache = [];
const loadMedia = async () => { mediaCache = await api("/media"); return mediaCache; };

// ------------------------------- auth -------------------------------
function loginView(msg = "") {
  const err = h("div", { class: "err", role: "alert" }, msg);
  const email = h("input", { type: "email", id: "e", autocomplete: "username", required: true }), pw = h("input", { type: "password", id: "p", autocomplete: "current-password", required: true });
  const show = h("button", { type: "button", class: "ghost sm", "aria-label": "Show password", onclick: () => { pw.type = pw.type === "password" ? "text" : "password"; show.textContent = pw.type === "password" ? "Show" : "Hide"; } }, "Show");
  const btn = h("button", { class: "primary", type: "submit" }, "Sign in");
  clear(root).append(h("div", { class: "login" }, h("div", { class: "card" }, h("h1", {}, "Admin sign in"), h("p", { class: "muted" }, "Private area. There is no public registration."),
    h("form", { onsubmit: async (ev) => {
      ev.preventDefault(); btn.disabled = true; err.textContent = "";
      try { const r = await api("/auth/login", { method: "POST", body: { email: email.value, password: pw.value } }); state.csrf = r.csrf; state.user = r.email; location.hash = "#/dashboard"; start(); }
      catch (e) { err.textContent = e.message; } finally { btn.disabled = false; }
    } }, h("div", { class: "field" }, h("label", { for: "e" }, "Email"), email), h("div", { class: "field" }, h("label", { for: "p" }, "Password"), h("div", { class: "pw" }, pw, show)), err, btn))));
}
setAuthLostHandler(() => { state.csrf = null; loginView("Your session expired. Please sign in again."); });

// ------------------------------- shell/router -------------------------------
const PAGES = {}; // filled at the bottom of the file, after every page function/const exists
async function start() {
  try { const me = await api("/auth/me"); state.csrf = me.csrf; state.user = me.email; } catch { return loginView(); }
  const main = h("main", { class: "main" }); const nav = h("nav", { "aria-label": "Admin" });
  clear(root).append(h("div", { class: "shell" }, h("aside", { class: "side" }, h("div", { class: "brand" }, h("i", {}, "//"), " admin"), nav,
    h("div", { class: "foot" }, h("div", { class: "muted" }, state.user), h("div", { class: "row" }, h("a", { href: "/", target: "_blank", rel: "noopener" }, "View site ↗"),
      h("button", { class: "sm", onclick: async () => { try { await api("/auth/logout", { method: "POST" }); } catch { /* ignore */ } state.csrf = null; loginView(); } }, "Sign out")))), main));
  const route = async () => {
    const key = (location.hash.replace(/^#\/?/, "") || "dashboard").split("/")[0]; const page = PAGES[key] ? key : "dashboard";
    clear(nav).append(...NAV.map(([k, l]) => h("a", { class: "nav", href: `#/${k}`, "aria-current": k === page ? "page" : null }, l)));
    clear(main);
    try { await PAGES[page](main); } catch (e) { main.append(h("div", { class: "card" }, e.message)); }
  };
  window.onhashchange = route; route();
}
const head = (title, sub, ...actions) => h("div", { class: "head" }, h("div", {}, h("h1", {}, title), sub ? h("p", {}, sub) : null), h("div", { class: "row" }, actions));

// ------------------------------- pages -------------------------------
async function dashboard(main) {
  const d = await api("/dashboard");
  const st = (v, l, cls = "") => h("div", { class: `card stat ${cls}` }, h("b", {}, v), h("span", { class: "muted" }, l));
  main.append(head("Dashboard", "Real numbers from your site — nothing estimated."),
    h("div", { class: "grid g4" }, st(d.projects_published, "Published projects"), st(d.projects_draft, "Draft projects"), st(d.messages_total, "Messages"), st(d.messages_unread, "Unread", d.messages_unread ? "warn" : ""),
      st(d.email_failed, "Failed email notifications", d.email_failed ? "warn" : ""), st(d.chat_7d, "Chatbot requests (7 days)"), st(d.chat_30d, "Chatbot requests (30 days)"), st(d.chat_errors_30d, "Chatbot issues (30 days)")),
    h("div", { class: "grid g2", style: null }, h("div", { class: "card" }, h("h2", {}, "Configuration status"), h("p", {}, "AI chatbot (Gemini): ", d.config.ai_configured ? h("span", { class: "chip ok" }, "configured") : h("span", { class: "chip warn" }, "not configured — basic mode")),
      h("p", {}, "Email provider: ", h("span", { class: `chip ${d.config.email_configured ? "ok" : "warn"}` }, `${d.config.email_provider}${d.config.email_configured ? "" : " (not ready)"}`)), h("p", { class: "muted small" }, "Secrets live in server environment variables and are never shown here.")),
      h("div", { class: "card" }, h("h2", {}, "Recent activity"), d.recent_activity.length ? h("ul", {}, d.recent_activity.map((a) => h("li", {}, `${a.action} · ${a.entity} `, h("span", { class: "muted small" }, fmt(a.at))))) : h("p", { class: "muted" }, "No activity yet."))));
}

async function settingsPage(groups, title, main) { /* replaced below */ }
async function renderSettings(main, groups, title) {
  const [all] = await Promise.all([api("/settings"), loadMedia()]);
  const panel = h("div"); const tabs = h("div", { class: "tabs", role: "tablist" });
  const show = (g) => {
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.g === g)));
    const form = buildForm(SCHEMAS[g], all[g], { media: mediaCache });
    clear(panel).append(h("div", { class: "card" }, h("h2", {}, g[0].toUpperCase() + g.slice(1)), form.el, h("div", { class: "row" }, h("button", { class: "primary", onclick: async () => {
      try { all[g] = await api(`/settings/${g}`, { method: "PUT", body: form.get() }); toast("Saved"); show(g); } catch (e) { if (e.details) form.showErrors(e.details); fail(e); } } }, "Save changes"))));
  };
  groups.forEach((g) => tabs.append(h("button", { role: "tab", "data-g": g, onclick: () => show(g) }, g)));
  main.append(head(title, "Changes apply to the public site immediately after saving."), groups.length > 1 ? tabs : null, panel); show(groups[0]);
}
const _settingsPage = (groups, title) => (main) => renderSettings(main, groups, title);

async function chatbot(main) {
  const [d] = await Promise.all([api("/dashboard")]);
  main.append(h("div", { class: "card" }, h("h2", {}, "Usage (last 30 days)"), h("p", {}, `${d.chat_30d} requests · ${d.chat_basic_30d} answered in basic mode · ${d.chat_errors_30d} with provider issues. Visitor questions are not stored.`),
    h("p", { class: "muted small" }, "The chatbot only reads published content. Edit what it knows under Projects, Skills and Website content.")));
  await renderSettings(main, ["chatbot"], "Chatbot settings");
}
async function email(main) {
  const d = await api("/dashboard");
  main.append(h("div", { class: "card" }, h("h2", {}, "Provider status"), h("p", {}, `Provider: ${d.config.email_provider} — ${d.config.email_configured ? "ready" : "not configured (set EMAIL_PROVIDER and keys in the server environment)"}`),
    h("p", { class: "muted small" }, "API keys and SMTP credentials are never editable or visible here. See docs/EMAIL_SETUP.md.")));
  await renderSettings(main, ["email", "seo"], "Email & site settings");
}

function reorderButtons(list, idx, kind, reload) {
  const move = async (d) => { const ids = list.map((x) => x.id); const j = idx + d; if (j < 0 || j >= ids.length) return; [ids[idx], ids[j]] = [ids[j], ids[idx]]; try { await api(`/${kind}/reorder`, { method: "POST", body: { ids } }); reload(); } catch (e) { fail(e); } };
  return h("span", { class: "row" }, h("button", { class: "sm", "aria-label": "Move up", disabled: idx === 0, onclick: () => move(-1) }, "↑"), h("button", { class: "sm", "aria-label": "Move down", disabled: idx === list.length - 1, onclick: () => move(1) }, "↓"));
}

async function projects(main) {
  await loadMedia(); const body = h("div");
  const edit = (p) => {
    const form = buildForm(PROJECT_SCHEMA, p || { category: "agentic-ai", status: "in-development", published: false }, { media: mediaCache });
    modal({ title: p ? `Edit: ${p.title}` : "New project", body: form.el, actions: [{ label: "Cancel", onClick: (c) => c() },
      ...(p ? [{ label: "Preview", onClick: async () => { try { const v = await api(`/projects/${p.id}/preview`); modal({ title: `Preview: ${v.title}`, body: h("div", {}, h("p", {}, v.summary), h("pre", { class: "msg-body" }, JSON.stringify(v, null, 2))) }); } catch (e) { fail(e); } } }] : []),
      { label: "Save", class: "primary", onClick: async (close) => { const data = form.get(); try { p ? await api(`/projects/${p.id}`, { method: "PUT", body: data }) : await api("/projects", { method: "POST", body: data }); close(); toast("Project saved"); load(); } catch (e) { if (e.details) form.showErrors(e.details); fail(e); } } }] });
  };
  const load = async () => {
    const list = await api("/projects");
    clear(body).append(h("div", { class: "tablewrap" }, h("table", {}, h("thead", {}, h("tr", {}, ["Order", "Project", "Category", "Status", "Visibility", ""].map((x) => h("th", {}, x)))),
      h("tbody", {}, list.length ? list.map((p, i) => h("tr", {}, h("td", {}, reorderButtons(list, i, "projects", load)), h("td", {}, h("b", {}, p.title), h("div", { class: "muted small mono" }, p.slug), p.featured ? h("span", { class: "chip warn" }, "featured") : null),
        h("td", {}, p.category), h("td", {}, p.status), h("td", {}, h("span", { class: `chip ${p.published ? "ok" : "dim"}` }, p.published ? "published" : "draft")),
        h("td", {}, h("div", { class: "row" }, h("button", { class: "sm", onclick: () => edit(p) }, "Edit"),
          h("button", { class: "sm", onclick: async () => { try { await api(`/projects/${p.id}/publish${qs({ published: !p.published })}`, { method: "POST" }); load(); } catch (e) { fail(e); } } }, p.published ? "Unpublish" : "Publish"),
          h("button", { class: "sm danger", onclick: async () => { if (await confirmBox("Delete project?", `“${p.title}” will be permanently deleted. Consider unpublishing instead.`)) { try { await api(`/projects/${p.id}`, { method: "DELETE" }); toast("Deleted"); load(); } catch (e) { fail(e); } } } }, "Delete")))))
        : h("tr", {}, h("td", { colspan: 6 }, "No projects yet."))))));
  };
  main.append(head("Projects", "Drafts stay private; the chatbot only learns from published projects.", h("button", { class: "primary", onclick: () => edit(null) }, "New project")), body); await load();
}

function crudTable({ title, sub, kind, schema, columns, groupBy }) {
  return async (main) => {
    await loadMedia(); const body = h("div");
    const edit = (it) => { const form = buildForm(schema, it || { published: true, kind: "experience" }, { media: mediaCache });
      modal({ title: it ? "Edit" : "Add", body: form.el, actions: [{ label: "Cancel", onClick: (c) => c() }, { label: "Save", class: "primary", onClick: async (close) => {
        try { it ? await api(`/${kind}/${it.id}`, { method: "PUT", body: form.get() }) : await api(`/${kind}`, { method: "POST", body: form.get() }); close(); toast("Saved"); load(); } catch (e) { if (e.details) form.showErrors(e.details); fail(e); } } }] }); };
    const load = async () => {
      const list = await api(`/${kind}`);
      clear(body).append(h("div", { class: "tablewrap" }, h("table", {}, h("thead", {}, h("tr", {}, ["Order", ...columns.map((c) => c[1]), "Visible", ""].map((x) => h("th", {}, x)))),
        h("tbody", {}, list.length ? list.map((it, i) => h("tr", {}, h("td", {}, reorderButtons(list, i, kind, load)), ...columns.map(([k]) => h("td", {}, String(it[k] ?? ""))), h("td", {}, h("span", { class: `chip ${it.published ? "ok" : "dim"}` }, it.published ? "yes" : "hidden")),
          h("td", {}, h("div", { class: "row" }, h("button", { class: "sm", onclick: () => edit(it) }, "Edit"), h("button", { class: "sm danger", onclick: async () => { if (await confirmBox("Delete?", "This cannot be undone.")) { try { await api(`/${kind}/${it.id}`, { method: "DELETE" }); load(); } catch (e) { fail(e); } } } }, "Delete")))))
          : h("tr", {}, h("td", { colspan: columns.length + 3 }, "Nothing here yet."))))));
    };
    main.append(head(title, sub, h("button", { class: "primary", onclick: () => edit(null) }, "Add")), body); await load();
  };
}
const skills = crudTable({ title: "Skills", sub: "Grouped by category on the public site. No proficiency percentages are shown.", kind: "skills", schema: SKILL_SCHEMA, columns: [["category", "Category"], ["name", "Skill"]] });
const items = crudTable({ title: "Experience, education & credentials", sub: "Only add verified entries.", kind: "items", schema: ITEM_SCHEMA, columns: [["kind", "Type"], ["title", "Title"], ["organization", "Organization"], ["start_date", "When"]] });

async function media(main) {
  const grid = h("div", { class: "media-grid" }); const kind = h("select", { "aria-label": "Upload type" }, h("option", { value: "image" }, "Image (PNG/JPEG/WebP/GIF, ≤5 MB)"), h("option", { value: "cv" }, "CV (PDF, ≤10 MB)"));
  const file = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif,application/pdf", "aria-label": "File" });
  const load = async () => { const list = await loadMedia(); clear(grid).append(...(list.length ? list.map((m) => h("div", { class: "card" }, m.mime.startsWith("image/") ? h("img", { src: m.url, alt: m.name, loading: "lazy" }) : h("div", { class: "muted" }, "PDF document"),
    h("div", { class: "small" }, m.name), h("div", { class: "muted small mono" }, m.url), h("div", { class: "row" }, h("a", { class: "small", href: m.url, target: "_blank", rel: "noopener" }, "Open"),
      h("button", { class: "sm danger", onclick: async () => { if (await confirmBox("Delete file?", "Files still used by a project or setting cannot be deleted.")) { try { await api(`/media/${m.id}`, { method: "DELETE" }); load(); } catch (e) { fail(e); } } } }, "Delete")))) : [h("p", { class: "muted" }, "No files yet.")])); };
  main.append(head("Media library", "Files are validated by content (not by extension) and stored with random names."), h("div", { class: "card" }, h("div", { class: "form-grid" }, h("div", { class: "field" }, h("label", {}, "Type"), kind), h("div", { class: "field" }, h("label", {}, "File"), file)),
    h("button", { class: "primary", onclick: async () => { if (!file.files[0]) return toast("Choose a file first", "error"); const fd = new FormData(); fd.append("file", file.files[0]); try { await api(`/media${qs({ kind: kind.value })}`, { method: "POST", form: fd }); file.value = ""; toast("Uploaded"); load(); } catch (e) { fail(e); } } }, "Upload")), grid); await load();
}

async function messages(main) {
  const st = { q: "", status: "", page: 1 }; const body = h("div");
  const show = async (id) => { const m = await api(`/messages/${id}`); if (m.status === "unread") await api(`/messages/${id}`, { method: "PATCH", body: { status: "read" } });
    modal({ title: m.subject, body: h("div", {}, h("p", {}, h("b", {}, m.name), " · ", h("a", { href: `mailto:${m.email}` }, m.email), h("br"), h("span", { class: "muted small" }, `${m.category} · ${fmt(m.created_at)}`)), h("div", { class: "msg-body" }, m.message),
      h("h3", { style: null }, "Email notification"), h("p", {}, h("span", { class: `chip ${m.email_status === "sent" ? "ok" : m.email_status === "failed" ? "bad" : "warn"}` }, m.email_status), " ", m.attempts.map((a) => h("div", { class: "muted small" }, `${a.kind} via ${a.provider}: ${a.ok ? "ok" : "failed — " + a.error} (${fmt(a.at)})`)))),
      onClose: load, actions: [{ label: "Archive", onClick: async (c) => { await api(`/messages/${id}`, { method: "PATCH", body: { status: "archived" } }); c(); } }, { label: "Mark unread", onClick: async (c) => { await api(`/messages/${id}`, { method: "PATCH", body: { status: "unread" } }); c(); } },
        ...(m.email_status !== "sent" ? [{ label: "Retry email", onClick: async (c) => { try { const r = await api(`/messages/${id}/retry-email`, { method: "POST" }); toast(`Notification ${r.email_status}`); c(); } catch (e) { fail(e); } } }] : []),
        { label: "Delete", class: "danger", onClick: async (c) => { if (await confirmBox("Delete message?", "This permanently removes it.")) { await api(`/messages/${id}`, { method: "DELETE" }); c(); } } }] }); };
  const load = async () => { const r = await api(`/messages${qs(st)}`); const pages = Math.max(1, Math.ceil(r.total / r.page_size));
    clear(body).append(h("div", { class: "tablewrap" }, h("table", {}, h("thead", {}, h("tr", {}, ["From", "Subject", "Category", "Email", "Received"].map((x) => h("th", {}, x)))),
      h("tbody", {}, r.items.length ? r.items.map((m) => h("tr", { class: m.status === "unread" ? "unread" : "" }, h("td", {}, h("a", { href: "#/messages", onclick: (e) => { e.preventDefault(); show(m.id); } }, m.name), h("div", { class: "muted small" }, m.email)), h("td", {}, m.subject), h("td", {}, m.category),
        h("td", {}, h("span", { class: `chip ${m.email_status === "sent" ? "ok" : m.email_status === "failed" ? "bad" : "warn"}` }, m.email_status)), h("td", {}, fmt(m.created_at)))) : h("tr", {}, h("td", { colspan: 5 }, "No messages.")))),
      h("div", { class: "row", style: null }, h("button", { class: "sm", disabled: st.page <= 1, onclick: () => { st.page--; load(); } }, "Prev"), h("span", { class: "muted small" }, `Page ${st.page}/${pages} · ${r.total} total`), h("button", { class: "sm", disabled: st.page >= pages, onclick: () => { st.page++; load(); } }, "Next")))); };
  const q = h("input", { type: "search", placeholder: "Search…", "aria-label": "Search messages", oninput: (e) => { clearTimeout(q._t); q._t = setTimeout(() => { st.q = e.target.value; st.page = 1; load(); }, 250); } });
  const sel = h("select", { "aria-label": "Filter by status", onchange: (e) => { st.status = e.target.value; st.page = 1; load(); } }, h("option", { value: "" }, "Inbox (unread + read)"), h("option", { value: "unread" }, "Unread"), h("option", { value: "read" }, "Read"), h("option", { value: "archived" }, "Archived"));
  main.append(head("Messages", "Contact form submissions. Only you can see these."), h("div", { class: "row" }, q, sel), body); await load();
}

async function audit(main) {
  const r = await api("/audit"); main.append(head("Audit history", "Important admin actions. Passwords, tokens and message contents are never logged."),
    h("div", { class: "tablewrap" }, h("table", {}, h("thead", {}, h("tr", {}, ["When", "Action", "Entity", "Details"].map((x) => h("th", {}, x)))), h("tbody", {}, r.items.map((a) => h("tr", {}, h("td", {}, fmt(a.at)), h("td", {}, a.action), h("td", {}, `${a.entity_type} ${a.entity_id || ""}`), h("td", { class: "mono small" }, JSON.stringify(a.details))))))));
}
Object.assign(PAGES, { dashboard, projects, content: _settingsPage(["hero", "about", "availability", "services", "contact", "social", "footer", "seo", "resume", "sections"], "Website content"),
  skills, items, design: _settingsPage(["design"], "Design & animation settings"), media, messages, chatbot, email, audit });
void settingsPage;
start();
