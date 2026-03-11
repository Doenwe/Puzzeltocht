// Live theme preview voor admin-theme pagina
(function () {
  const form = document.querySelector("#theme-form");
  if (!form) return;

  const apply = () => {
    const root = document.documentElement;
    const primaryColor = form.primaryColor.value || "#2563eb";
    const backgroundColor = form.backgroundColor.value || "#ffffff";
    const textColor = form.textColor.value || "#111827";
    const borderRadius = form.borderRadius.value || "0.75rem";
    const fontFamily = form.fontFamily.value || "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, Apple Color Emoji, Segoe UI Emoji";

    root.style.setProperty("--primary", primaryColor);
    root.style.setProperty("--bg", backgroundColor);
    root.style.setProperty("--text", textColor);
    root.style.setProperty("--radius", borderRadius);
    root.style.setProperty("--font", fontFamily);
  };

  // live updates bij elke wijziging
  form.addEventListener("input", apply);
  apply(); // initial
})();
