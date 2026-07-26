export function ThemeScript() {
  const script = `
    try {
      var preference = localStorage.getItem("stormhub-theme");
      if (preference !== "light" && preference !== "dark" && preference !== "system") preference = "system";
      var dark = preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.dataset.theme = preference;
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    } catch (_) {}
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
