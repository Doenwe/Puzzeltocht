// public/app.js
(function () {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    const form = document.getElementById("theme-form");
    if (!form) return;

    const $ = (name) => form.elements.namedItem(name);

    const fields = {
      primaryColor: { el: $("primaryColor"), fallback: "#2563eb" },
      backgroundColor: { el: $("backgroundColor"), fallback: "#ffffff" },
      textColor: { el: $("textColor"), fallback: "#111827" },
      borderRadius: { el: $("borderRadius"), fallback: "0.75rem" },
      fontFamily: {
        el: $("fontFamily"),
        fallback:
          "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, Apple Color Emoji, Segoe UI Emoji",
      },
    };

    let rafId = null;
    const schedule = (fn) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(fn);
    };

    const applyTheme = () => {
      const root = document.documentElement;
      root.style.setProperty("--primary", get("primaryColor"));
      root.style.setProperty("--bg", get("backgroundColor"));
      root.style.setProperty("--text", get("textColor"));
      root.style.setProperty("--radius", get("borderRadius"));
      root.style.setProperty("--font", get("fontFamily"));
    };

    function get(name) {
      const f = fields[name];
      if (!f) return "";
      const el = f.el;
      if (!el) return f.fallback;
      const val = (el.value || "").trim();
      return val || f.fallback;
    }

    function onInput() {
      schedule(applyTheme);
    }

    Object.values(fields).forEach(({ el }) => {
      if (el) {
        el.addEventListener("input", onInput);
        el.addEventListener("change", onInput);
      }
    });

    applyTheme();
  }
})();
