(() => {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("lang");
  const validRequest = requested === "zh" || requested === "zh-CN" || requested === "en";
  let stored = "";

  try {
    stored = window.localStorage.getItem("portfolio-language") || "";
  } catch {
    stored = "";
  }

  const language = validRequest
    ? requested === "en" ? "en" : "zh-CN"
    : stored === "zh-CN" || stored === "zh" ? "zh-CN" : "en";

  window.portfolioInitialLanguage = language === "zh-CN" ? "zh" : "en";
  document.documentElement.lang = language;
  document.documentElement.dataset.language = language === "zh-CN" ? "zh" : "en";
  if (language === "zh-CN") document.documentElement.classList.add("i18n-pending");
  window.portfolioLanguageTimeout = window.setTimeout(() => {
    if (window.portfolioLanguageReady) return;
    document.documentElement.lang = "en";
    document.documentElement.dataset.language = "en";
    document.documentElement.classList.remove("i18n-pending");
    console.error("Portfolio language setup did not finish. Canonical English remains available.");
  }, 4000);

  if (validRequest) {
    try {
      window.localStorage.setItem("portfolio-language", language);
    } catch {
      // The URL continues to carry the choice when storage is unavailable.
    }
  }
})();
