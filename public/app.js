// public/app.js
// Live thema-preview voor /admin-theme
// - Werkt ook als elementen ontbreken (fail-safe)
// - Past CSS-variabelen toe op :root
// - Debounced updates voor performance

(function () {
  // Wacht tot DOM klaar is
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    const form = document.getElementById("theme-form");
    if (!form) {
      // Niet op de admin-theme pagina, of formulier ontbreekt.
      return;
    }

    // Haal velden op; als iets ontbreekt zetten we veilige defaults
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

    // Debounce helper
    let rafId = null;
    const schedule = (fn) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(fn);
    };

    // Toepassen van CSS-variabelen op :root
    const applyTheme = () => {
      const root = document.documentElement;

      const primaryColor = getValue("primaryColor");
      const backgroundColor = getValue("backgroundColor");
      const textColor = getValue("textColor");
      const borderRadius = getValue("borderRadius");
      const fontFamily = getValue("fontFamily");

      root.style.setProperty("--primary", primaryColor);
      root.style.setProperty("--bg", backgroundColor);
      root.style.setProperty("--text", textColor);
      root.style.setProperty("--radius", borderRadius);
      root.style.setProperty("--font", fontFamily);
    };

    // Veilig waarde ophalen met fallback
    function getValue(name) {
      const f = fields[name];
      if (!f) return "";
      const el = f.el;
      if (!el) return f.fallback;
      const val = (el.value || "").trim();
      return val || f.fallback;
    }

    // Valideer eenvoudige inputs (optioneel visuele hint bij fout)
    function validateInline() {
      // borderRadius mag bijv. "12px" of "0.75rem" zijn—browser accepteert alles als string,
      // maar we kunnen een simpele check doen op lege string
      if (fields.borderRadius?.el && !fields.borderRadius.el.value.trim()) {
        fields.borderRadius.el.value = fields.borderRadius.fallback;
      }
      // kleuren zijn <input type="color">, dus zijn per definitie geldig
    }

    // Live updates
    const onInput = () => {
      validateInline();
      schedule(applyTheme);
    };

    // Event listeners op alle bekende velden
    Object.values(fields).forEach(({ el }) => {
      if (el) {
        el.addEventListener("input", onInput);
        el.addEventListener("change", onInput);
      }
    });

    // Eerste render direct
    applyTheme();

    // (Optioneel) kleine UX: toon “Opgeslagen” badge tijdelijk als ?saved=1
    const params = new URLSearchParams(window.location.search);
    const saved = params.get("saved");
    if (saved) {
      // Verwijder de query na 2s zodat de badge verdwijnt bij volgende navigatie
      setTimeout(() => {
        params.delete("saved");
        const newUrl =
          window.location.pathname +
          (params.toString() ? "?" + params.toString() : "");
        window.history.replaceState({}, "", newUrl);
      }, 2000);
    }
  }
})();
