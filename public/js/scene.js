// 3D background: neural-network point cloud + wireframe "AI core". Loaded lazily; never blocks first paint.
// Skipped when: reduced motion, animations/3D disabled in admin, no WebGL, Save-Data, or very low-end devices.
import { clamp } from "./util.js";

const ROUTES = {
  home: { cam: [0, 0, 10.5], core: [3.6, 0.3, -1], scale: 1, spin: 1 },
  projects: { cam: [-1.2, 0.4, 11.5], core: [-4.6, 1.6, -3], scale: 0.7, spin: 1.6 },
  project: { cam: [0.4, -0.4, 9], core: [4.6, -1, -2], scale: 0.85, spin: 0.8 },
};

function cssColor(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function canRun3D() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (navigator.connection?.saveData) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return false;
  try { const c = document.createElement("canvas"); return Boolean(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

export async function initScene(canvas, { intensity = "medium" } = {}) {
  const THREE = await import("/vendor/three.module.min.js");
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" }); } catch { return null; }
  const mobile = matchMedia("(max-width: 760px)").matches;
  const motion = { low: 0.5, medium: 1, high: 1.5 }[intensity] || 1;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 60);
  camera.position.set(0, 0, 10.5);

  // deterministic pseudo-random so the layout is stable between visits
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const net = new THREE.Group(); scene.add(net);
  const N = mobile ? 70 : intensity === "high" ? 190 : 130;
  const pos = new Float32Array(N * 3); const pts = [];
  for (let i = 0; i < N; i++) {
    const r = 4 + rnd() * 6.5, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
    const p = new THREE.Vector3(r * Math.sin(ph) * Math.cos(th), (r * Math.sin(ph) * Math.sin(th)) * 0.7, r * Math.cos(ph) - 3);
    pts.push(p); pos.set([p.x, p.y, p.z], i * 3);
  }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ size: mobile ? 0.09 : 0.075, transparent: true, opacity: 0.9, sizeAttenuation: true, depthWrite: false });
  net.add(new THREE.Points(pGeo, pMat));
  const seg = []; const MAXD = 3.1;
  for (let i = 0; i < N && seg.length < 900; i++) for (let j = i + 1; j < N && seg.length < 900; j++) if (pts[i].distanceTo(pts[j]) < MAXD) seg.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
  const lGeo = new THREE.BufferGeometry(); lGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(seg), 3));
  const lMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false });
  net.add(new THREE.LineSegments(lGeo, lMat));

  const core = new THREE.Group(); scene.add(core);
  const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 1), new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.55 }));
  const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.018, 8, 140), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6 }));
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.012, 8, 140), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35 }));
  ring.rotation.x = Math.PI / 2.4; ring2.rotation.set(Math.PI / 3, Math.PI / 5, 0);
  core.add(wire, inner, ring, ring2);
  const moons = [];
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 + rnd() * 0.12), new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.8 })); m.userData = { a: rnd() * 6.28, r: 2.5 + rnd() * 1.4, s: 0.2 + rnd() * 0.35, y: (rnd() - 0.5) * 2.2 }; core.add(m); moons.push(m); }

  function applyColors() {
    const dark = document.documentElement.getAttribute("data-theme") !== "light";
    const a1 = new THREE.Color(cssColor("--a1", "#35e0ff")), a2 = new THREE.Color(cssColor("--a2", "#8b5cf6"));
    pMat.color.copy(a1); lMat.color.copy(a2); wire.material.color.copy(a1); inner.material.color.copy(a2); ring.material.color.copy(a1); ring2.material.color.copy(a2);
    moons.forEach((m, i) => m.material.color.copy(i % 2 ? a1 : a2));
    const blend = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    [pMat, lMat].forEach((m) => { m.blending = blend; m.needsUpdate = true; });
    pMat.opacity = dark ? 0.9 : 0.75; lMat.opacity = dark ? 0.22 : 0.3; wire.material.opacity = dark ? 0.55 : 0.5;
  }
  applyColors();

  const mouse = { x: 0, y: 0 }; let scroll = 0; let route = ROUTES.home;
  const target = { cam: new THREE.Vector3(...route.cam), core: new THREE.Vector3(...route.core), scale: route.scale };
  const onMove = (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; };
  const onScroll = () => { scroll = clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight), 0, 1); };
  addEventListener("pointermove", onMove, { passive: true }); addEventListener("scroll", onScroll, { passive: true });

  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.position.z = (route === ROUTES.home ? 10.5 : route.cam[2]) + (w < 760 ? 3.5 : 0); camera.updateProjectionMatrix();
  }
  let rt; const onResize = () => { clearTimeout(rt); rt = setTimeout(resize, 120); }; addEventListener("resize", onResize); resize();

  let raf = 0, last = performance.now(), running = true, acc = 0; const frameMs = intensity === "low" ? 1000 / 30 : 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; acc += dt * 1000; if (frameMs && acc < frameMs) return; acc = 0;
    const t = now / 1000, k = 1 - Math.pow(0.002, dt);       // frame-rate independent easing
    net.rotation.y += dt * 0.035 * motion * route.spin; net.rotation.x = Math.sin(t * 0.1) * 0.08 + scroll * 0.6;
    core.rotation.y += dt * 0.25 * motion * route.spin; core.rotation.x += dt * 0.08 * motion; ring.rotation.z += dt * 0.3 * motion; ring2.rotation.y -= dt * 0.2 * motion;
    inner.scale.setScalar(1 + Math.sin(t * 1.4) * 0.06);
    moons.forEach((m) => { const d = m.userData; d.a += dt * d.s * motion; m.position.set(Math.cos(d.a) * d.r, d.y + Math.sin(t + d.a) * 0.2, Math.sin(d.a) * d.r); m.rotation.x += dt; m.rotation.y += dt * 0.7; });
    const mobileShift = innerWidth < 760 ? 0.6 : 1;
    const wantCam = target.cam.clone(); wantCam.x += mouse.x * 0.9 * motion; wantCam.y += -mouse.y * 0.6 * motion - scroll * 2.2; if (innerWidth < 760) wantCam.z += 3.5;
    camera.position.lerp(wantCam, k * 0.6); camera.lookAt(0, -scroll * 1.2, -2);
    core.position.lerp(target.core.clone().multiplyScalar(mobileShift).add(new THREE.Vector3(0, -scroll * 3, 0)), k * 0.6);
    const sc = core.scale.x + (target.scale * (innerWidth < 760 ? 0.7 : 1) - core.scale.x) * k * 0.6; core.scale.setScalar(sc);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); cancelAnimationFrame(raf); canvas.classList.remove("ready"); });

  return {
    setRoute(name) { route = ROUTES[name] || ROUTES.home; target.cam.set(...route.cam); target.core.set(...route.core); target.scale = route.scale; },
    refreshColors: applyColors,
    destroy() { running = false; cancelAnimationFrame(raf); removeEventListener("pointermove", onMove); removeEventListener("scroll", onScroll); removeEventListener("resize", onResize); renderer.dispose(); [pGeo, lGeo].forEach((g) => g.dispose()); },
    get running() { return running; },
  };
}
