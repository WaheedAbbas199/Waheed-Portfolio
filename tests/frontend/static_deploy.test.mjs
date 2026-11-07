// Regression test for "works locally, blank on Vercel": serve the prebuilt vercel-site/ folder with a plain static server
// (unknown paths -> 404, exactly like static hosting: there is NO /api) and boot the real app against it.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../vercel-site");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml" };
let server, base;
before(async () => {
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname); const file = path.join(ROOT, rel === "/" ? "index.html" : rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { "content-type": "text/html" }); return res.end("<h1>404</h1>"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }); fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, r)); base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.closeAllConnections?.(); server.close(); });

test("the deployable folder is complete and contains no old hosted URLs", () => {
  for (const f of ["index.html", "config.js", "vercel.json", "data/site.json", "css/app.css", "css/theme.css", "js/main.js", "js/theme-init.js", "vendor/three.module.min.js"]) assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} exists`);
  const snap = JSON.parse(fs.readFileSync(path.join(ROOT, "data/site.json"), "utf8")); assert.ok(snap.settings.hero.name && snap.projects.length > 0);
  for (const f of ["index.html", "config.js", "vercel.json", "data/site.json"]) assert.ok(!/vercel\.app|blush/i.test(fs.readFileSync(path.join(ROOT, f), "utf8")), `${f} has no old site URL`);
  assert.ok(!fs.readFileSync(path.join(ROOT, "index.html"), "utf8").includes("<!--SEO_META-->"), "SEO placeholder was filled");
});

test("static host: no API exists (404) yet the portfolio renders from the bundled snapshot, quietly", async () => {
  const dom = new JSDOM('<!doctype html><html data-theme="dark" data-motion="on"><body><canvas id="scene"></canvas><div id="app"></div></body></html>', { url: base + "/", pretendToBeVisual: true });
  const w = dom.window;
  for (const k of ["window", "document", "Node", "HTMLElement", "Event", "SVGElement"]) globalThis[k] = k === "window" ? w : w[k];
  Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true });
  w.matchMedia = globalThis.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
  for (const k of ["location", "localStorage", "sessionStorage", "addEventListener", "removeEventListener", "scrollTo", "getComputedStyle"]) globalThis[k] = typeof w[k] === "function" ? w[k].bind(w) : w[k];
  Object.defineProperty(globalThis, "scrollY", { get: () => 0, configurable: true }); Object.defineProperty(globalThis, "innerWidth", { value: 1200, configurable: true });
  globalThis.requestAnimationFrame = (f) => setTimeout(() => f(performance.now()), 0); w.Element.prototype.scrollIntoView = function () {};
  const realFetch = globalThis.fetch; const seen = [];
  globalThis.fetch = (url, opts) => { const abs = new URL(String(url), base).href; seen.push(abs); return realFetch(abs, opts); };
  w.PORTFOLIO_CONFIG = globalThis.PORTFOLIO_CONFIG = { apiBase: "" };
  const errors = []; process.on("unhandledRejection", (e) => errors.push(e));

  await import("../../public/js/main.js"); await new Promise((r) => setTimeout(r, 600));
  const doc = w.document;
  assert.ok(seen.some((u) => u.endsWith("/api/v1/public/site")), "tried the API first");
  assert.ok(seen.some((u) => u.endsWith("/data/site.json")), "fell back to the snapshot");
  assert.ok(doc.querySelector("header.header"), "header rendered"); assert.match(doc.querySelector("h1").textContent, /Waheed Abbas/);
  assert.ok(doc.querySelectorAll(".pcard").length >= 1, "projects rendered"); assert.ok(doc.querySelector("#skills"), "skills section rendered");
  assert.equal(doc.querySelector(".offline-note"), null, "no scary 'offline' banner in static-only mode");
  assert.equal(doc.querySelector(".chat-fab"), null, "chatbot hidden when there is no backend");
  assert.equal(doc.querySelector("#contact form"), null, "contact form replaced by email fallback"); assert.ok(doc.querySelector('#contact a[href^="mailto:"]'));
  assert.ok(!/temporarily unavailable/i.test(doc.body.textContent));
  assert.deepEqual(errors, []);
  void realFetch;
});
