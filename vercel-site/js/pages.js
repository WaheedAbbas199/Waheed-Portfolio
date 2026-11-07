import { h, icon, clear } from "./dom.js";
import { getProject, mediaUrl } from "./api.js";
import { CATEGORY_LABELS, STATUS_LABELS, filterProjects, projectCategories, safeHref } from "./util.js";
import { linkBtn, projectCard, projectCover, sectionHead, timelineItem } from "./components.js";
import { buildContactForm } from "./contact.js";
import { countUp, onceVisible } from "./effects.js";

const on = (sections, k) => sections[k] !== false;

export function homePage(ctx) {
  const { settings: st, skills, items, projects } = ctx.site;
  const hero = st.hero, sec = st.sections, soc = st.social.links;
  const topSkills = Object.values(skills).flat().slice(0, 4);
  const img = hero.profile_image_url;
  const roles = h("span", { id: "roles" }, hero.roles[0] || "");
  const featured = projects.filter((p) => p.featured);
  const showcase = (featured.length ? featured : projects).slice(0, 6);
  const techCount = new Set(projects.flatMap((p) => p.tech)).size;
  const cv = st.resume.cv_download_url;

  const heroEl = h("section", { class: "hero", id: "top", "aria-label": "Introduction" }, h("div", { class: "wrap" },
    h("div", {},
      h("div", { class: "eyebrow reveal" }, hero.eyebrow),
      h("h1", { class: "reveal" }, h("span", { class: "grad" }, hero.name)),
      h("div", { class: "roles reveal", "aria-live": "off" }, roles, h("span", { class: "caret", "aria-hidden": "true" })),
      h("p", { class: "lead reveal" }, hero.headline, hero.intro ? [" ", hero.intro] : null),
      h("div", { class: "cta-row reveal" },
        h("a", { class: "btn primary magnetic", href: "#/projects" }, hero.primary_cta_label || "View projects", icon("arrow", 18)),
        cv ? h("a", { class: "btn magnetic", href: mediaUrl(cv), target: "_blank", rel: "noopener noreferrer" }, "Download CV", icon("download", 18)) : h("span", { class: "btn", "aria-disabled": "true", title: "CV not published yet" }, "CV coming soon"),
        h("a", { class: "btn magnetic", href: "#/contact" }, "Contact me", icon("mail", 18))),
      h("div", { class: "socials reveal" }, soc.map((l) => { const href = safeHref(l.url); const n = l.label.toLowerCase(); return href ? h("a", { class: "icon-btn", href, target: "_blank", rel: "noopener noreferrer", "aria-label": l.label, title: l.label }, icon(n.includes("linkedin") ? "linkedin" : n.includes("git") ? "github" : "ext")) : null; })),
      hero.facts.length ? h("div", { class: "facts" }, hero.facts.map((f) => h("div", { class: "fact reveal" }, h("b", {}, f.label), f.value))) : null),
    h("div", { class: "portrait reveal", "aria-hidden": img ? null : "true" },
      h("div", { class: "frame" }, img ? h("img", { src: mediaUrl(img), alt: `Portrait of ${hero.name}`, width: 340, height: 340, decoding: "async" })
        : h("div", { style: null, class: "mono", "data-mono": "" }, "")),
      h("div", { class: "orbit" }, topSkills.map((t) => h("span", {}, t))))),
    h("div", { class: "scroll-cue", "aria-hidden": "true" }, "SCROLL", h("i")));
  if (!img) { const f = heroEl.querySelector("[data-mono]"); f.append(h("span", { class: "grad", style: null }, hero.name.split(" ").map((w) => w[0]).join(""))); f.classList.add("monogram"); }

  const stats = [[projects.length, "Projects"], [techCount, "Technologies"], [Object.keys(skills).length, "Skill areas"]].filter(([n]) => n > 0);
  const about = on(sec, "about") && st.about.paragraphs.length ? h("section", { class: "sec", id: "about" }, h("div", { class: "wrap" }, sectionHead("01", "About"),
    h("div", { class: "about-grid" },
      h("div", { class: "reveal" }, st.about.paragraphs.map((p) => h("p", {}, p)),
        h("div", { class: "stat-row" }, stats.map(([n, l]) => { const b = h("b", {}, "0"); onceVisible(b, () => countUp(b, n)); return h("div", { class: "stat" }, b, h("span", { class: "muted" }, l)); }))),
      h("div", { class: "grid" }, st.about.highlights.map((x) => h("div", { class: "tilt reveal" }, h("div", { class: "card" }, h("h3", { class: "pop2" }, x.title), h("p", { class: "muted pop2", style: null }, x.text)))))))) : null;

  const skillsEl = on(sec, "skills") && Object.keys(skills).length ? h("section", { class: "sec", id: "skills" }, h("div", { class: "wrap" }, sectionHead("02", "Skills", "Grouped by what I actually build with — no made-up percentages."),
    h("div", { class: "grid g3" }, Object.entries(skills).map(([cat, names]) => h("div", { class: "tilt reveal" }, h("div", { class: "card skill-card" }, h("h3", { class: "pop2" }, cat), h("div", { class: "tags pop2" }, names.map((n) => h("span", { class: "chip" }, n))))))))) : null;

  const projEl = on(sec, "projects") ? h("section", { class: "sec", id: "featured" }, h("div", { class: "wrap" }, sectionHead("03", "Featured projects", "Agentic AI systems built milestone by milestone — architecture first, then a working application."),
    showcase.length ? h("div", { class: `projects ${st.design.project_layout === "list" ? "list" : ""}` }, showcase.map((p) => projectCard(p, { tilt: st.design.tilt_cards })))
      : h("div", { class: "empty" }, "Projects will appear here once published."),
    projects.length > showcase.length || projects.length ? h("p", { class: "reveal", style: null }, h("a", { class: "btn", href: "#/projects" }, `All ${projects.length} projects`, icon("arrow", 18))) : null)) : null;

  const exp = items.experience || [], edu = items.education || [], certs = [...(items.certification || []), ...(items.achievement || [])];
  const showExp = on(sec, "experience") && exp.length, showEdu = on(sec, "education") && edu.length, showCert = on(sec, "certifications") && certs.length;
  const journey = showExp || showEdu || showCert ? h("section", { class: "sec", id: "experience" }, h("div", { class: "wrap" }, sectionHead("04", "Experience & education"),
    h("div", { class: "two-col" },
      showExp ? h("div", {}, h("h3", { class: "reveal" }, "Experience"), h("ul", { class: "timeline" }, exp.map(timelineItem))) : null,
      showEdu ? h("div", {}, h("h3", { class: "reveal" }, "Education"), h("ul", { class: "timeline" }, edu.map(timelineItem))) : null,
      showCert ? h("div", {}, h("h3", { class: "reveal" }, "Certifications & achievements"), h("ul", { class: "timeline" }, certs.map(timelineItem))) : null))) : null;

  const svc = st.services;
  const services = on(sec, "services") && svc.items.length ? h("section", { class: "sec", id: "services" }, h("div", { class: "wrap" }, sectionHead("05", "Services", svc.intro),
    h("div", { class: "grid g2" }, svc.items.map((x, i) => h("div", { class: "tilt reveal" }, h("div", { class: "card svc" }, h("span", { class: "num pop2" }, String(i + 1).padStart(2, "0")), h("h3", { class: "pop2" }, x.title), h("p", { class: "muted pop2", style: null }, x.description))))))) : null;

  const resume = on(sec, "resume") ? h("section", { class: "sec", id: "resume" }, h("div", { class: "wrap" }, sectionHead("06", "Résumé"),
    h("div", { class: "card resume-box reveal" }, h("div", {}, h("h3", {}, "Résumé / CV"), h("p", { class: "muted", style: null }, "Experience, education and skills in one document.")),
      cv ? h("div", { class: "cta-row", style: null }, h("a", { class: "btn", href: mediaUrl(cv), target: "_blank", rel: "noopener noreferrer" }, "View", icon("ext", 18)), h("a", { class: "btn primary", href: mediaUrl(cv), download: "Waheed-Abbas-CV.pdf" }, "Download", icon("download", 18)))
        : h("span", { class: "chip" }, "Not published yet")))) : null;

  const contactSec = on(sec, "contact") ? h("section", { class: "sec", id: "contact" }, h("div", { class: "wrap" }, sectionHead("07", "Contact", st.contact.intro),
    h("div", { class: "contact-grid" },
      h("div", { class: "reveal" }, h("div", { class: "card" }, h("h3", {}, "Get in touch"), h("div", { class: "info-list" },
        st.contact.email ? h("a", { href: `mailto:${st.contact.email}` }, icon("mail"), st.contact.email) : null,
        st.contact.location ? h("div", {}, icon("spark"), st.contact.location) : null,
        soc.map((l) => { const href = safeHref(l.url); return href ? h("a", { href, target: "_blank", rel: "noopener noreferrer" }, icon(l.label.toLowerCase().includes("linkedin") ? "linkedin" : "github"), l.label) : null; })))),
      h("div", { class: "reveal" }, h("div", { class: "card" }, buildContactForm(ctx)))))) : null;

  const page = h("div", { class: "page" }, heroEl, about, skillsEl, projEl, journey, services, resume, contactSec);
  return { el: page, roles };
}

export function projectsPage(ctx) {
  const { projects, settings: st } = ctx.site;
  let cat = "all"; let layout = st.design.project_layout;
  const grid = h("div", { class: "projects" });
  const count = h("p", { class: "muted", role: "status", "aria-live": "polite" });
  const draw = () => {
    const list = filterProjects(projects, cat);
    grid.className = `projects ${layout === "list" ? "list" : ""}`;
    clear(grid).append(...(list.length ? list.map((p) => projectCard(p, { tilt: st.design.tilt_cards })) : [h("div", { class: "empty" }, "No projects in this category yet.")]));
    count.textContent = `${list.length} project${list.length === 1 ? "" : "s"}`;
    ctx.refreshEffects(grid);
  };
  const cats = [{ id: "all", label: "All" }, ...projectCategories(projects)];
  const pills = h("div", { class: "filters", role: "group", "aria-label": "Filter projects by category" }, cats.map((c) => h("button", { class: "pill", type: "button", "aria-pressed": String(c.id === cat), onclick: (e) => {
    cat = c.id; pills.querySelectorAll(".pill").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); draw(); } }, c.label)));
  const layoutBtn = h("button", { class: "pill", type: "button", "aria-pressed": String(layout === "list"), onclick: (e) => { layout = layout === "list" ? "grid" : "list"; e.currentTarget.setAttribute("aria-pressed", String(layout === "list")); draw(); } }, "List view");
  const el = h("div", { class: "page" }, h("section", { class: "sec detail-head" }, h("div", { class: "wrap" },
    h("a", { class: "back", href: "#/" }, icon("arrow", 18), "Home"), sectionHead("//", "Projects", "Everything I've built, filterable by area. Open a project for its case study."),
    h("div", { style: null, class: "toolbar" }, pills, layoutBtn), count, grid)));
  draw();
  return { el };
}

export async function projectPage(ctx, slug) {
  const wrap = h("div", { class: "wrap" });
  const el = h("div", { class: "page" }, h("section", { class: "sec detail-head" }, wrap));
  wrap.append(h("a", { class: "back", href: "#/projects" }, icon("arrow", 18), "All projects"), h("div", { class: "skeleton" }));
  let p; let notFound = false;
  try { p = await getProject(slug); }
  catch (e) { if (e.status === 404) notFound = true; else p = ctx.site.projects.find((x) => x.slug === slug); }   // offline: fall back to the summary we already have
  clear(wrap).append(h("a", { class: "back", href: "#/projects" }, icon("arrow", 18), "All projects"));
  if (!p || notFound) { wrap.append(h("div", { class: "empty" }, "This project could not be found. It may be unpublished."), h("p", {}, h("a", { class: "btn", href: "#/projects" }, "Back to projects"))); return { el, title: "Project not found" }; }
  const idx = ctx.site.projects.findIndex((x) => x.slug === p.slug); const prev = ctx.site.projects[idx - 1], next = ctx.site.projects[idx + 1];
  const sect = (title, body) => (body && body.length ? [h("h2", {}, title), body] : null);
  const text = (t) => (t ? h("p", { class: "prewrap" }, t) : null);
  wrap.append(
    h("div", { class: "meta reveal in mono", style: null }, h("span", { class: "badge" }, STATUS_LABELS[p.status] || p.status), " ", CATEGORY_LABELS[p.category] || p.category),
    h("h1", { class: "reveal in", style: null }, p.title), h("p", { class: "lead muted reveal in", style: null }, p.summary),
    h("div", { class: "cta-row" }, linkBtn(p.github_url, "View on GitHub", "github", "btn primary"), linkBtn(p.live_url, "Live demo", "ext", "btn"), !p.github_url && !p.live_url ? h("span", { class: "chip" }, "Source & demo links not published yet") : null),
    h("div", { class: "case" },
      h("div", { class: "card reveal" }, sect("Problem", text(p.problem)), sect("Solution", text(p.solution)), p.features?.length ? [h("h2", {}, "Key features"), h("ul", {}, p.features.map((f) => h("li", {}, f)))] : null,
        sect("Architecture", text(p.architecture)), sect("Challenges & solutions", text(p.challenges)), p.results ? [h("h2", {}, "Verified results"), text(p.results)] : null,
        !p.problem && !p.solution && !p.architecture ? h("p", { class: "muted" }, "A detailed case study for this project is being written. The summary above describes what it does.") : null),
      h("div", {}, h("div", { class: "card reveal", style: null }, h("div", { class: "cover" }, projectCover(p)), h("h2", { style: null, class: "" }, "Technology"), h("div", { class: "tags" }, (p.tech || []).map((t) => h("span", { class: "chip" }, t))))),),
    h("div", { class: "cta-row", style: null }, prev ? h("a", { class: "btn", href: `#/project/${prev.slug}` }, "← " + prev.title) : null, next ? h("a", { class: "btn", href: `#/project/${next.slug}` }, next.title + " →") : null));
  return { el, title: p.title };
}
