import assert from "node:assert/strict";
import { test } from "node:test";
import { clamp, filterProjects, parseRoute, projectCategories, safeHref, speechLang, speechSupport, trimHistory, validateContact } from "../../public/js/util.js";

const P = [{ slug: "a", category: "agentic-ai" }, { slug: "b", category: "nlp-rag" }, { slug: "c", category: "agentic-ai" }];

test("project filters", () => {
  assert.equal(filterProjects(P, "all").length, 3);
  assert.deepEqual(filterProjects(P, "agentic-ai").map((p) => p.slug), ["a", "c"]);
  assert.equal(filterProjects(P, "computer-vision").length, 0);
  assert.deepEqual(projectCategories(P).map((c) => c.id), ["agentic-ai", "nlp-rag"]);
  assert.equal(projectCategories(P)[1].label, "NLP & RAG");
});

test("routing", () => {
  assert.deepEqual(parseRoute(""), { page: "home", section: "" });
  assert.deepEqual(parseRoute("#/projects"), { page: "projects" });
  assert.deepEqual(parseRoute("#/project/my-agent"), { page: "project", slug: "my-agent" });
  assert.deepEqual(parseRoute("#/contact"), { page: "home", section: "contact" });
  assert.deepEqual(parseRoute("#/nonsense"), { page: "home", section: "" });
});

test("chat history trimming keeps last turns and drops invalid roles", () => {
  const hist = [...Array.from({ length: 10 }, (_, i) => ({ role: "user", content: `t${i}` })), { role: "system", content: "evil" }, { role: "assistant", content: "" }];
  const out = trimHistory(hist, 6);
  assert.equal(out.length, 6); assert.equal(out.at(-1).content, "t9"); assert.ok(out.every((t) => t.role !== "system"));
  assert.equal(trimHistory([{ role: "user", content: "x".repeat(900) }])[0].content.length, 600);
});

test("speech capability detection has safe fallbacks", () => {
  assert.deepEqual(speechSupport({}), { recognition: false, synthesis: false });
  assert.deepEqual(speechSupport(null), { recognition: false, synthesis: false });
  assert.equal(speechSupport({ webkitSpeechRecognition: function () {} }).recognition, true);
  assert.equal(speechSupport({ speechSynthesis: {}, SpeechSynthesisUtterance: function () {} }).synthesis, true);
  assert.equal(speechLang("ur"), "ur-PK"); assert.equal(speechLang("roman-ur"), "en-US"); assert.equal(speechLang("??"), "en-US");
});

test("safeHref blocks script URLs", () => {
  assert.equal(safeHref("javascript:alert(1)"), null); assert.equal(safeHref("data:text/html,x"), null);
  assert.equal(safeHref("https://github.com/x"), "https://github.com/x"); assert.equal(safeHref("mailto:a@b.co"), "mailto:a@b.co");
});

test("contact validation", () => {
  assert.deepEqual(Object.keys(validateContact({})).sort(), ["category", "email", "message", "name", "subject"]);
  assert.deepEqual(validateContact({ name: "A", email: "a@b.co", category: "x", subject: "s", message: "long enough message" }), {});
  assert.ok(validateContact({ name: "A", email: "bad", category: "x", subject: "s", message: "long enough message" }).email);
  assert.ok(validateContact({ name: "A", email: "a@b.co", category: "x", subject: "s", message: "x".repeat(4001) }).message);
  assert.equal(clamp(5, 0, 3), 3);
});
