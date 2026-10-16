(() => {
  const translations = window.portfolioTranslations;
  const normalize = (value) => value.replace(/\s+/g, " ").trim();
  const records = [];
  const registeredText = new WeakSet();
  const registeredAttributes = new WeakMap();
  const reportedMissing = new Set();
  let language = "en";
  let languageApplied = false;
  const controls = document.createElement("div");
  controls.className = "language-switch";
  controls.setAttribute("role", "group");
  const buttons = ["zh", "en"].map((value) => {
    const button = document.createElement("button");
    button.type = "button";
    const label = document.createElement("span");
    label.lang = value === "zh" ? "zh-CN" : "en";
    label.textContent = value === "zh" ? "中文" : "EN";
    button.append(label);
    button.dataset.language = value;
    controls.append(button);
    if (value === "zh") {
      const divider = document.createElement("span");
      divider.setAttribute("aria-hidden", "true");
      divider.textContent = "/";
      controls.append(divider);
    }
    return button;
  });

  function remember(value) {
    try {
      window.localStorage.setItem("portfolio-language", value);
    } catch {
      // Language-bearing links and the URL work without browser storage.
    }
  }

  function requestedLanguage() {
    const value = new URLSearchParams(window.location.search).get("lang");
    if (value === "zh" || value === "zh-CN") return "zh";
    if (value === "en") return "en";
    try {
      return ["zh", "zh-CN"].includes(window.localStorage.getItem("portfolio-language")) ? "zh" : "en";
    } catch {
      return "en";
    }
  }

  function updateLinks() {
    const preference = new URLSearchParams(window.location.search).get("scoutTheme");
    document.querySelectorAll('a[href]').forEach((link) => {
      const destination = new URL(link.getAttribute("href"), window.location.href);
      if (destination.origin !== window.location.origin || !["http:", "https:"].includes(destination.protocol)) return;
      destination.searchParams.set("lang", language);
      if (preference === "light" || preference === "dark") destination.searchParams.set("scoutTheme", preference);
      link.href = destination.pathname + destination.search + destination.hash;
    });
  }

  const text = (english) => language === "zh" ? translations[english] || english : english;

  function registerContent(root = document) {
    // A fragment is empty after its children have been mounted into the document.
    if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE && !root.hasChildNodes()) root = document;
    const added = [];
    const registerText = (node) => {
      if (registeredText.has(node)) return;
      const parent = node.parentElement;
      const key = normalize(node.nodeValue);
      if (!key || parent?.closest("script, style, template, .language-copy, .wordmark-dot, .resume-copy, .language-switch")) return;
      registeredText.add(node);
      added.push({ node, original: node.nodeValue, key });
    };
    if (root.nodeType === Node.TEXT_NODE) registerText(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) registerText(walker.currentNode);

    const selector = "[aria-label], [alt], [title], meta[name=description]";
    const elements = Array.from(root.querySelectorAll?.(selector) || []);
    if (root.nodeType === Node.ELEMENT_NODE && root.matches(selector)) elements.unshift(root);
    elements.forEach((node) => {
      if (node.closest("template, .resume-copy, .language-switch")) return;
      let attributes = registeredAttributes.get(node);
      if (!attributes) {
        attributes = new Set();
        registeredAttributes.set(node, attributes);
      }
      ["aria-label", "alt", "title", "content"].forEach((attribute) => {
        if (attributes.has(attribute) || (attribute === "content" && !node.matches("meta[name=description]"))) return;
        const original = node.getAttribute(attribute);
        if (!original) return;
        attributes.add(attribute);
        added.push({ node, attribute, original, key: normalize(original) });
      });
    });
    records.push(...added);

    const invariants = new Set(window.portfolioTranslationInvariants);
    const missing = [...new Set(added.map(({ key }) => key))].filter((key) =>
      /[A-Za-z]/.test(key) && !Object.hasOwn(translations, key) && !invariants.has(key) && !reportedMissing.has(key));
    missing.forEach((key) => reportedMissing.add(key));
    if (missing.length) console.error("Missing portfolio translations:", missing);
  }

  function applyLanguage(value, keepPosition = false) {
    const languageChanged = !languageApplied || value !== language;
    const landmarks = Array.from(document.querySelectorAll("main section, .featured-project"));
    const landmark = keepPosition ? landmarks.findLast((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top <= window.innerHeight / 3 && rect.bottom > 0;
    }) : null;
    const previousTop = landmark?.getBoundingClientRect().top;
    language = value;
    records.forEach(({ node, attribute, original, key }) => {
      const translated = language === "zh" && Object.hasOwn(translations, key)
        ? original.replace(/\S[\s\S]*\S|\S/, () => translations[key])
        : original;
      if (attribute) node.setAttribute(attribute, translated);
      else node.nodeValue = translated;
    });
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.documentElement.dataset.language = language;
    controls.setAttribute("aria-label", text("Language"));
    buttons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.language === language));
      button.setAttribute("aria-label", text(button.dataset.language === "zh" ? "Read in Chinese" : "Read in English"));
    });
    updateLinks();
    remember(language);
    document.documentElement.classList.remove("i18n-pending");
    if (landmark) {
      window.scrollTo({ top: window.scrollY + landmark.getBoundingClientRect().top - previousTop, behavior: "instant" });
    }
    languageApplied = true;
    if (languageChanged) {
      window.dispatchEvent(new CustomEvent("portfolio-language-changed", { detail: { language } }));
    }
  }

  window.portfolioI18n = {
    refresh(root = document) {
      if (translations && typeof translations === "object") {
        registerContent(root);
        applyLanguage(language);
      } else {
        updateLinks();
      }
    }
  };

  if (translations && typeof translations === "object") {
    registerContent();
    document.querySelector(".site-header nav").append(controls);
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.language;
        const url = new URL(window.location.href);
        url.searchParams.set("lang", value);
        if (url.href !== window.location.href) window.history.pushState(null, "", url);
        applyLanguage(value, true);
      });
    });
    window.addEventListener("popstate", () => applyLanguage(requestedLanguage(), true));
    applyLanguage(window.portfolioInitialLanguage || requestedLanguage());
  } else {
    document.documentElement.lang = "en";
    document.documentElement.dataset.language = "en";
    document.documentElement.classList.remove("i18n-pending");
    updateLinks();
    console.error("Portfolio translations could not be loaded. Canonical English remains available.");
  }
  window.clearTimeout(window.portfolioLanguageTimeout);
  window.portfolioLanguageReady = true;

  document.querySelector(".resume-print")?.addEventListener("click", () => window.print());
})();
