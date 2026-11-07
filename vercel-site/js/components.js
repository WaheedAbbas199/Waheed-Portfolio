import { h, s, icon } from "./dom.js";
import { CATEGORY_LABELS, STATUS_LABELS, formatPeriod, hashString, safeHref } from "./util.js";
import { mediaUrl } from "./api.js";

export function sectionHead(no, title, lead) {
  return [h("div", { class: "sec-head reveal" }, h("span", { class: "sec-no" }, no), h("h2", { class: "sec-title" }, title)),
    lead ? h("p", { class: "sec-lead reveal" }, lead) : null];
}

// Deterministic generative cover (used when a project has no uploaded image): an "agent graph" seeded by the slug.
export function projectCover(p) {
  if (p.image_url) return h("img", { src: mediaUrl(p.image_url), alt: `${p.title} screenshot`, loading: "lazy", decoding: "async", width: 640, height: 360 });
  let seed = hashString(p.slug || p.title) || 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const nodes = Array.from({ length: 11 }, () => [40 + rnd() * 560, 30 + rnd() * 300, 3 + rnd() * 5]);
  const g = s("g", { stroke: "var(--a1)", "stroke-opacity": ".45", "stroke-width": "1.2" });
  nodes.forEach((a, i) => nodes.slice(i + 1).forEach((b) => { if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 190) g.append(s("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1] })); }));
  const dots = s("g", { fill: "var(--a1)" }); nodes.forEach((n, i) => dots.append(s("circle", { cx: n[0], cy: n[1], r: n[2], fill: i % 3 === 0 ? "var(--a2)" : "var(--a1)" })));
  return s("svg", { viewBox: "0 0 640 360", role: "img", "aria-label": `${p.title} generated cover` , preserveAspectRatio: "xMidYMid slice" },
    s("defs", {}, s("linearGradient", { id: `g${hashString(p.slug)}`, x1: 0, y1: 0, x2: 1, y2: 1 }, s("stop", { offset: "0", "stop-color": "var(--a2)", "stop-opacity": ".35" }), s("stop", { offset: "1", "stop-color": "var(--a1)", "stop-opacity": ".12" }))),
    s("rect", { width: 640, height: 360, fill: `url(#g${hashString(p.slug)})` }), g, dots,
    s("text", { x: 24, y: 336, "font-family": "ui-monospace,Consolas,monospace", "font-size": 15, fill: "currentColor", opacity: ".7" }, (CATEGORY_LABELS[p.category] || p.category).toUpperCase()));
}

export function linkBtn(url, label, ico = "ext", cls = "btn sm") {
  const href = safeHref(url || "");
  return href ? h("a", { class: cls, href, target: "_blank", rel: "noopener noreferrer" }, label, icon(ico, 16)) : null;
}

export function projectCard(p, { tilt = true } = {}) {
  const link = `#/project/${encodeURIComponent(p.slug)}`;
  return h("article", { class: `${tilt ? "tilt" : ""} reveal` },
    h("div", { class: "card pcard" },
      h("div", { class: "cover" }, projectCover(p)),
      h("div", { class: "body" },
        h("div", { class: "meta pop2" }, h("span", { class: "badge" }, STATUS_LABELS[p.status] || p.status), h("span", {}, CATEGORY_LABELS[p.category] || p.category)),
        h("h3", { class: "pop2" }, h("a", { href: link, class: "stretch", style: null }, p.title)),
        h("p", { class: "sum" }, p.summary || "Case study coming soon."),
        p.tech?.length ? h("div", { class: "tags" }, p.tech.slice(0, 5).map((t) => h("span", { class: "chip" }, t)), p.tech.length > 5 ? h("span", { class: "chip" }, `+${p.tech.length - 5}`) : null) : null,
        h("div", { class: "links", style: null }, linkBtn(p.github_url, "GitHub", "github"), linkBtn(p.live_url, "Live demo")))));
}

export function timelineItem(it) {
  const link = it.url && safeHref(it.url);
  return h("li", { class: "t-item reveal" }, h("div", { class: "card" },
    h("div", { class: "when" }, formatPeriod(it.start, it.end)), h("h3", {}, it.title), it.organization ? h("div", { class: "muted" }, it.organization) : null,
    it.description ? h("p", { class: "muted prewrap", style: null }, it.description) : null,
    link ? h("a", { href: link, target: "_blank", rel: "noopener noreferrer" }, "Verify credential ↗") : null));
}

export function offlineNotice() {
  return h("div", { class: "offline-note", role: "status" }, "Showing the saved copy of this portfolio — live features like the chatbot and contact form are temporarily offline. Email me directly instead.");
}
