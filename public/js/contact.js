import { h, icon } from "./dom.js";
import { sendContact } from "./api.js";
import { validateContact } from "./util.js";

export function buildContactForm(ctx) {
  const cats = ctx.site.settings.contact.categories;
  const email = ctx.site.settings.contact.email;
  const shownAt = Date.now();
  if (ctx.offline) return h("div", {}, h("h3", {}, "Send a message"), h("p", { class: "muted" }, "The contact form needs the live server, which is offline right now."),
    email ? h("a", { class: "btn primary", href: `mailto:${email}` }, "Email me directly", icon("mail", 18)) : null);

  const f = (id, label, el, hint) => h("div", { class: "field" }, h("label", { for: id }, label, h("span", { class: "req", "aria-hidden": "true" }, " *")), el, h("div", { class: "err", id: `${id}-err`, role: "alert" }));
  const name = h("input", { id: "c-name", name: "name", type: "text", autocomplete: "name", required: true, maxlength: 120, "aria-describedby": "c-name-err" });
  const mail = h("input", { id: "c-email", name: "email", type: "email", autocomplete: "email", required: true, maxlength: 200, "aria-describedby": "c-email-err" });
  const cat = h("select", { id: "c-category", name: "category", required: true, "aria-describedby": "c-category-err" }, h("option", { value: "" }, "Choose a category…"), cats.map((c) => h("option", { value: c }, c)));
  const subject = h("input", { id: "c-subject", name: "subject", type: "text", required: true, maxlength: 200, "aria-describedby": "c-subject-err" });
  const msg = h("textarea", { id: "c-message", name: "message", required: true, maxlength: 4000, "aria-describedby": "c-message-err c-count" });
  const count = h("div", { id: "c-count", class: "muted", style: null }, "0 / 4000");
  msg.addEventListener("input", () => { count.textContent = `${msg.value.length} / 4000`; });
  const hp = h("div", { class: "hp", "aria-hidden": "true" }, h("label", { for: "c-website" }, "Leave this empty"), h("input", { id: "c-website", name: "website", type: "text", tabindex: "-1", autocomplete: "off" }));
  const status = h("div", { role: "status", "aria-live": "polite" });
  const btn = h("button", { class: "btn primary", type: "submit" }, "Send message", icon("send", 18));
  const fields = { name, email: mail, category: cat, subject, message: msg };

  const showErrors = (errs) => Object.entries(fields).forEach(([k, el]) => {
    const e = document.getElementById(`c-${k === "email" ? "email" : k}-err`); if (e) e.textContent = errs[k] || "";
    el.setAttribute("aria-invalid", errs[k] ? "true" : "false");
  });

  const form = h("form", { class: "form", novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    const values = { name: name.value, email: mail.value, category: cat.value, subject: subject.value, message: msg.value };
    const errs = validateContact(values); showErrors(errs);
    if (Object.keys(errs).length) { fields[Object.keys(errs)[0]].focus(); return; }
    btn.disabled = true; status.replaceChildren(h("span", { class: "spin", "aria-hidden": "true" }), " Sending…");
    try {
      await sendContact({ ...values, website: hp.querySelector("input").value, elapsed_ms: Date.now() - shownAt });
      form.reset(); count.textContent = "0 / 4000";
      status.replaceChildren(h("div", { class: "alert ok" }, icon("check", 18), " Thanks — your message has been saved. I'll reply to the email address you provided."));
    } catch (e) {
      const server = {}; (e.details || []).forEach((d) => { if (d.field in fields) server[d.field] = d.message; }); showErrors(server);
      status.replaceChildren(h("div", { class: "alert bad", role: "alert" }, e.network ? "I couldn't reach the server. Please try again, or email me directly." : e.message));
    } finally { btn.disabled = false; }
  } },
    f("c-name", "Name", name), f("c-email", "Email", mail), f("c-category", "Inquiry type", cat), f("c-subject", "Subject", subject), f("c-message", "Message", msg), count, hp, btn, status);
  return form;
}
