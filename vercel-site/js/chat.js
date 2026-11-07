// Floating portfolio assistant: text + optional voice. Mic starts only after an explicit click; speech output only when the visitor presses speak.
import { h, icon } from "./dom.js";
import { getChatConfig, sendChat } from "./api.js";
import { safeHref, speechLang, speechSupport, trimHistory } from "./util.js";

const KEY = "pf_chat_history";

export async function initChat(host, ctx) {
  let cfg;
  try { cfg = await getChatConfig(); } catch { return; }
  if (!cfg.enabled || ctx.offline) return;
  const sup = speechSupport(window);
  let history = []; try { history = JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch { /* ignore */ }
  let busy = false, rec = null, listening = false, lastQuestion = "", speaking = false;
  const langSel = h("select", { "aria-label": "Voice language" }, cfg.languages.map((l) => h("option", { value: l }, { en: "English", ur: "اردو (Urdu)", "roman-ur": "Roman Urdu" }[l])));
  const log = h("div", { class: "chat-log", role: "log", "aria-live": "polite", "aria-label": "Conversation" });
  const status = h("div", { class: "status", role: "status", "aria-live": "polite" });
  const input = h("textarea", { rows: 1, maxlength: 800, placeholder: "Ask about skills, projects, contact…", "aria-label": "Your question", enterkeyhint: "send" });
  const send = h("button", { class: "mini send", type: "submit", "aria-label": "Send message" }, icon("send", 18));
  const mic = h("button", { class: "mini", type: "button", "aria-label": "Start voice input", "aria-pressed": "false", title: sup.recognition ? "Speak your question" : "Voice input isn't supported in this browser", disabled: !sup.recognition }, icon("mic", 18));
  const sugg = h("div", { class: "sugg" }, cfg.suggested.map((q) => h("button", { type: "button", onclick: () => ask(q) }, q)));
  const closeBtn = h("button", { class: "icon-btn", type: "button", "aria-label": "Close chat", onclick: () => toggle(false) }, icon("close", 18));
  const clearBtn = h("button", { class: "icon-btn", type: "button", "aria-label": "Clear conversation", title: "Clear conversation", onclick: reset }, icon("trash", 18));
  const panel = h("section", { class: "chat", id: "chat-panel", role: "dialog", "aria-label": "Portfolio assistant", hidden: true },
    h("header", {}, h("h2", {}, "Portfolio assistant", h("span", { class: "sub" }, cfg.ai_available ? "AI answers from Waheed's published portfolio" : "Basic mode · answers come straight from the portfolio")), clearBtn, closeBtn),
    log, sugg, status,
    h("div", { class: "opts" }, h("label", {}, "Voice language ", langSel), sup.synthesis ? null : h("span", {}, "Read-aloud isn't supported here")),
    h("form", { onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (v) ask(v); } }, mic, input, send));
  const fab = h("button", { class: "chat-fab", type: "button", "aria-label": "Open portfolio assistant", "aria-expanded": "false", "aria-controls": "chat-panel", onclick: () => toggle(panel.hidden) }, icon("chat", 26));
  host.append(panel, fab);

  function toggle(open) {
    panel.hidden = !open; fab.setAttribute("aria-expanded", String(open));
    if (open) { if (!log.children.length) bot(cfg.welcome, { skipStore: true }); setTimeout(() => input.focus(), 60); } else { stopListening(); stopSpeaking(); fab.focus(); }
  }
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) toggle(false); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const v = input.value.trim(); if (v) ask(v); } });
  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = `${Math.min(input.scrollHeight, 110)}px`; });

  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const store = () => { try { sessionStorage.setItem(KEY, JSON.stringify(history.slice(-20))); } catch { /* ignore */ } };
  function user(text) { log.append(h("div", { class: "msg me" }, text)); scroll(); }
  function bot(text, { sources = [], mode = "", skipStore = false, retry = null } = {}) {
    const tools = h("div", { class: "tools" },
      h("button", { type: "button", "aria-label": "Copy answer", title: "Copy", onclick: async () => { try { await navigator.clipboard.writeText(text); status.textContent = "Copied."; } catch { status.textContent = "Couldn't copy."; } } }, icon("copy", 16)),
      sup.synthesis ? h("button", { type: "button", "aria-label": "Read answer aloud", title: "Read aloud", onclick: () => speak(text) }, icon("speaker", 16)) : null,
      sup.synthesis ? h("button", { type: "button", "aria-label": "Stop reading", title: "Stop", onclick: stopSpeaking }, icon("stop", 16)) : null,
      retry ? h("button", { type: "button", "aria-label": "Retry", title: "Retry", onclick: retry }, icon("refresh", 16)) : null);
    const srcs = sources.map((s) => ({ ...s, href: safeHref(s.url || "") })).filter((s) => s.href);
    const el = h("div", { class: "msg bot" }, text, srcs.length ? h("div", { class: "srcs" }, srcs.map((s) => h("a", { class: "chip", href: s.href, target: "_blank", rel: "noopener noreferrer" }, s.title))) : null, mode === "basic" ? h("div", { class: "muted small" }, "Basic mode answer") : null, tools);
    log.append(el); scroll(); if (!skipStore) { history.push({ role: "assistant", content: text }); store(); }
  }
  function reset() { history = []; store(); log.replaceChildren(); stopSpeaking(); bot(cfg.welcome, { skipStore: true }); sugg.hidden = false; }

  async function ask(q) {
    if (busy) return; busy = true; lastQuestion = q; sugg.hidden = true; stopListening();
    user(q); input.value = ""; input.style.height = "auto";
    const typing = h("div", { class: "msg bot", "aria-label": "Assistant is typing" }, h("span", { class: "typing" }, h("i"), h("i"), h("i"))); log.append(typing); scroll();
    send.disabled = true; status.textContent = "Thinking…";
    const prior = trimHistory(history);
    history.push({ role: "user", content: q }); store();
    try {
      const r = await sendChat(q, prior); typing.remove(); bot(r.answer, { sources: r.sources, mode: r.mode }); status.textContent = "";
    } catch (e) {
      typing.remove(); history.pop(); store();
      const msg = e.status === 429 ? "You're sending messages quickly — please wait a moment." : e.network ? "I can't reach the server right now. Please try again, or use the contact form." : e.message;
      bot(msg, { skipStore: true, retry: () => ask(lastQuestion) }); status.textContent = "";
    } finally { busy = false; send.disabled = false; }
  }

  // ---- voice input (Web Speech API; availability differs per browser, so text input always remains) ----
  function stopListening() { if (rec && listening) { try { rec.stop(); } catch { /* ignore */ } } listening = false; mic.setAttribute("aria-pressed", "false"); mic.setAttribute("aria-label", "Start voice input"); }
  mic.addEventListener("click", () => {
    if (listening) return stopListening();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    rec = new SR(); rec.lang = speechLang(langSel.value); rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
    rec.onstart = () => { listening = true; mic.setAttribute("aria-pressed", "true"); mic.setAttribute("aria-label", "Stop voice input"); status.textContent = "Listening… speak now."; };
    rec.onresult = (ev) => { input.value = Array.from(ev.results).map((r) => r[0].transcript).join(" "); input.dispatchEvent(new Event("input")); };
    rec.onerror = (ev) => { status.textContent = ev.error === "not-allowed" || ev.error === "service-not-allowed" ? "Microphone permission was denied. You can still type your question." : ev.error === "no-speech" ? "I didn't hear anything. Try again or type." : "Voice input isn't available right now. Please type instead."; stopListening(); };
    rec.onend = () => { if (listening) stopListening(); if (input.value.trim()) status.textContent = "Edit the text if needed, then press send."; };
    try { rec.start(); } catch { status.textContent = "Voice input couldn't start."; }
  });

  // ---- voice output ----
  function speak(text) {
    if (!sup.synthesis) return; stopSpeaking();
    const u = new SpeechSynthesisUtterance(text); u.lang = speechLang(langSel.value); u.rate = 1;
    u.onend = u.onerror = () => { speaking = false; }; speaking = true; speechSynthesis.speak(u);
  }
  function stopSpeaking() { if (sup.synthesis && (speaking || speechSynthesis.speaking)) speechSynthesis.cancel(); speaking = false; }
  addEventListener("pagehide", stopSpeaking);

  if (history.length) { history.forEach((t) => (t.role === "user" ? user(t.content) : bot(t.content, { skipStore: true }))); sugg.hidden = true; }
}
