export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v; else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (["value", "checked", "disabled", "selected", "hidden"].includes(k)) el[k] = v; else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) { if (c === null || c === undefined || c === false) continue; el.append(c instanceof Node ? c : document.createTextNode(String(c))); }
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const toast = (msg, kind = "info") => { const t = h("div", { class: `toast ${kind}` }, msg); document.getElementById("toasts").append(t); setTimeout(() => t.remove(), kind === "error" ? 8000 : 3500); };
export const fmt = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

export function modal({ title, body, actions = [], onClose }) {
  const dlg = h("dialog", { "aria-labelledby": "mt" });
  const close = () => { dlg.close(); dlg.remove(); onClose?.(); };
  dlg.append(h("div", { class: "dh" }, h("h2", { id: "mt", style: null }, title), h("button", { class: "ghost sm", onclick: close, "aria-label": "Close" }, "✕")), h("div", { class: "db" }, body),
    actions.length ? h("div", { class: "df" }, actions.map((a) => h("button", { class: a.class || "", onclick: () => a.onClick(close) }, a.label))) : null);
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  document.body.append(dlg); dlg.showModal(); return { close, dlg };
}
export const confirmBox = (title, text, label = "Delete") => new Promise((res) => modal({ title, body: h("p", {}, text), onClose: () => res(false), actions: [{ label: "Cancel", onClick: (c) => c() }, { label, class: "danger", onClick: (c) => { res(true); c(); } }] }));

// ---- schema-driven form: one renderer for every settings group and entity ----
// field: {key,label,type:text|textarea|number|bool|select|list|objlist|media, options, hint, fields (objlist), mediaKind, max}
export function buildForm(schema, values, { media = [] } = {}) {
  const getters = {}; const root = h("div", { class: "form-grid" });
  for (const f of schema) {
    const id = `f_${f.key}_${Math.random().toString(36).slice(2, 6)}`; const v = values?.[f.key];
    const err = h("div", { class: "err", "data-err": f.key }); let input;
    if (f.type === "textarea") { input = h("textarea", { id, value: v ?? "" }); getters[f.key] = () => input.value; }
    else if (f.type === "bool") { input = h("input", { id, type: "checkbox", checked: !!v }); getters[f.key] = () => input.checked; }
    else if (f.type === "number") { input = h("input", { id, type: "number", value: v ?? "" }); getters[f.key] = () => (input.value === "" ? null : Number(input.value)); }
    else if (f.type === "select") { input = h("select", { id }, f.options.map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return h("option", { value: val, selected: val === v }, lab); })); getters[f.key] = () => input.value; }
    else if (f.type === "list") { input = h("textarea", { id, value: (v || []).join("\n"), placeholder: "one per line" }); getters[f.key] = () => input.value.split("\n").map((x) => x.trim()).filter(Boolean); }
    else if (f.type === "media") {
      const list = media.filter((m) => m.kind === (f.mediaKind || "image"));
      input = h("select", { id }, h("option", { value: "" }, "— none —"), list.map((m) => h("option", { value: m.id, selected: m.id === v }, `${m.name} (${Math.round(m.size / 1024)} KB)`))); getters[f.key] = () => input.value || null;
    } else if (f.type === "objlist") {
      const rows = h("div"); const addRow = (val = {}) => {
        const sub = buildForm(f.fields, val, { media }); const row = h("div", { class: "objrow" }, sub.el, h("div", { class: "row" }, h("button", { type: "button", class: "sm", onclick: () => { const i = [...rows.children].indexOf(row); if (i > 0) rows.insertBefore(row, rows.children[i - 1]); } }, "↑"),
          h("button", { type: "button", class: "sm", onclick: () => { const nx = row.nextElementSibling; if (nx) rows.insertBefore(nx, row); } }, "↓"), h("button", { type: "button", class: "sm danger", onclick: () => row.remove() }, "Remove"))); row._get = sub.get; rows.append(row); };
      (v || []).forEach(addRow); input = h("div", {}, rows, h("button", { type: "button", class: "sm", onclick: () => addRow() }, "+ Add")); getters[f.key] = () => [...rows.children].map((r) => r._get());
    } else { input = h("input", { id, type: "text", value: v ?? "", maxlength: f.max }); getters[f.key] = () => input.value; }
    root.append(h("div", { class: `field ${["textarea", "objlist", "list"].includes(f.type) ? "wide" : ""}`, style: ["textarea", "objlist", "list"].includes(f.type) ? null : null }, f.type === "bool" ? h("label", {}, input, ` ${f.label}`) : h("label", { for: id }, f.label, f.hint ? h("span", { class: "hint" }, ` ${f.hint}`) : null), f.type === "bool" ? null : input, err));
  }
  return { el: root, get: () => Object.fromEntries(Object.entries(getters).map(([k, g]) => [k, g()])),
    showErrors(details) { root.querySelectorAll(".err").forEach((e) => (e.textContent = "")); (details || []).forEach((d) => { const top = String(d.field).split(".")[0]; const e = root.querySelector(`[data-err="${top}"]`); if (e) e.textContent = d.message; }); } };
}
