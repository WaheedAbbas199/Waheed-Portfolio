// Runs before first paint (blocking, external => CSP friendly) so there is no light/dark flash.
(function () {
  try {
    var saved = localStorage.getItem("pf_theme");
    var pref = saved || "system";
    var dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    var accent = localStorage.getItem("pf_accent_cache");
    if (accent) document.documentElement.setAttribute("data-accent", accent);
  } catch (e) { document.documentElement.setAttribute("data-theme", "dark"); }
})();
