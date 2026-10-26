(() => {
  // A visitor gate for GitHub Pages, not server-side access control. The public
  // repository and asset URLs remain public. Keep the default HTML inert.
  const PASSWORD_DIGEST = "efd758702eea8915a72bf6b584f155ea2d24e0be030e8fd04ddcac2ab5309fdd";
  const SESSION_KEY = "portfolio-work-access-v1";
  const PUBLIC_HOME_IDS = new Set([
    "", "main", "hero-title", "approach", "approach-heading", "about",
    "about-heading", "contact", "contact-heading", "access-heading",
    "work", "work-heading", "copilot-content-finance", "copilot-core",
    "advertising-platform", "microsoft-internationalization", "earlier-work"
  ]);
  let unlocked = false;
  try { unlocked = sessionStorage.getItem(SESSION_KEY) === "unlocked"; } catch { /* Use this page's memory. */ }
  let destination = null;
  let trigger = null;
  let attempt = 0;

  const dialog = document.createElement("dialog");
  dialog.className = "access-dialog";
  dialog.setAttribute("aria-labelledby", "access-dialog-title");
  dialog.setAttribute("aria-describedby", "access-help");
  dialog.innerHTML = `
    <h2 class="access-dialog-heading" id="access-dialog-title">Password required</h2>
    <p class="access-dialog-description" id="access-help">Enter the password to view my selected work and case studies.</p>
    <form class="access-form" novalidate>
      <label class="access-label" for="access-password">Password</label>
      <input class="access-input" id="access-password" name="password" type="password" autocomplete="current-password" maxlength="128" required aria-describedby="access-errors" autofocus>
      <div class="access-error" id="access-errors" role="alert" aria-atomic="true">
        <p data-access-error="empty" hidden>Enter a password.</p>
        <p data-access-error="wrong" hidden>That password is incorrect. Try again.</p>
        <p data-access-error="unavailable" hidden>Unable to unlock the work. Please try again.</p>
      </div>
      <div class="access-actions">
        <button class="access-primary" type="submit"><span data-access-submit>Unlock</span><span data-access-busy hidden>Unlocking…</span></button>
        <button class="access-secondary" type="button" data-access-cancel>Cancel</button>
      </div>
      <a class="access-contact" href="mailto:tsonglee@qq.com">Contact me for access</a>
    </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector("form");
  const input = dialog.querySelector("input");
  const submit = dialog.querySelector('[type="submit"]');

  function fragment(url) {
    try { return decodeURIComponent(url.hash.slice(1)).split(":~:text=")[0]; }
    catch { return ""; }
  }

  function isHome(path) { return path === "/" || path === "/index.html"; }

  function requiresAccess(url) {
    return url.origin === location.origin &&
      (url.pathname.startsWith("/work/") || (isHome(url.pathname) && !PUBLIC_HOME_IDS.has(fragment(url))));
  }

  function samePage(url) {
    return url.pathname === location.pathname || (isHome(url.pathname) && isHome(location.pathname));
  }

  function showError(kind) {
    dialog.querySelectorAll("[data-access-error]").forEach((item) => {
      item.hidden = item.dataset.accessError !== kind;
    });
    if (kind) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function setBusy(value) {
    submit.disabled = value;
    input.readOnly = value;
    dialog.querySelector("[data-access-submit]").hidden = value;
    dialog.querySelector("[data-access-busy]").hidden = !value;
    form.setAttribute("aria-busy", String(value));
  }

  function mountWork() {
    document.documentElement.dataset.workAccess = "unlocked";
    const template = document.querySelector("#protected-work");
    if (template) {
      const content = template.content;
      if (template.dataset.accessKind === "home") {
        const work = content.querySelector("#work-content");
        work.id = "work";
        document.querySelector('[data-access-shell]').replaceWith(content);
      } else {
        content.querySelector("#protected-main").id = "main";
        document.querySelectorAll("[data-access-shell]").forEach((shell) => shell.remove());
        template.before(content);
      }
      template.remove();
    }
    const footer = document.querySelector(".site-footer");
    if (footer && !footer.querySelector("[data-lock-work]")) {
      const lock = document.createElement("button");
      lock.type = "button";
      lock.className = "access-lock";
      lock.dataset.lockWork = "";
      lock.textContent = "Lock work";
      footer.append(lock);
    }
    window.portfolioI18n?.refresh();
  }

  function mountHomepageListing() {
    // New design: the homepage listing (images + summaries) is public.
    // Clicking any case study still requires the password, unchanged.
    // This mounts the template content without unlocking anything: the
    // click handler still gates /work/ links because `unlocked` stays false.
    if (unlocked || !isHome(location.pathname)) return;
    const template = document.querySelector("#protected-work");
    const shell = document.querySelector('[data-access-shell]');
    if (!template || template.dataset.accessKind !== "home" || !shell) return;
    const content = template.content;
    const work = content.querySelector("#work-content");
    if (!work) return;
    work.id = "work";
    shell.replaceWith(content);
    template.remove();
    window.portfolioI18n?.refresh();
  }

  function moveTo(url) {
    if (!samePage(url)) {
      location.assign(url.href);
      return;
    }
    if (url.href !== location.href) history.pushState(null, "", url.href);
    const target = document.getElementById(fragment(url)) || document.querySelector("main");
    if (!target) return;
    const heading = target.matches("h1, h2, h3, h4") ? target : target.querySelector("h1, h2, h3, h4");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
      heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
    }
    target.scrollIntoView({ behavior: "instant", block: "start" });
  }

  function requestAccess(url, control) {
    if (unlocked) return;
    destination = url;
    trigger = control || document.querySelector("[data-unlock-work]");
    if (dialog.open) return;
    dialog.returnValue = "";
    input.value = "";
    showError(null);
    setBusy(false);
    dialog.showModal();
    input.focus();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    if (!input.value) {
      showError("empty");
      input.focus();
      return;
    }
    const currentAttempt = ++attempt;
    setBusy(true);
    showError(null);
    try {
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.value));
      if (currentAttempt !== attempt || !dialog.open) return;
      const actual = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
      if (actual !== PASSWORD_DIGEST) {
        setBusy(false);
        showError("wrong");
        input.select();
        input.focus();
        return;
      }
      unlocked = true;
      try { sessionStorage.setItem(SESSION_KEY, "unlocked"); } catch { /* Keep this page unlocked. */ }
      const next = destination || new URL(location.href);
      dialog.close("unlocked");
      mountWork();
      moveTo(next);
    } catch {
      if (currentAttempt !== attempt || !dialog.open) return;
      setBusy(false);
      showError("unavailable");
      input.focus();
    }
  });

  input.addEventListener("input", () => showError(null));
  dialog.querySelector("[data-access-cancel]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    attempt += 1;
    input.value = "";
    setBusy(false);
    showError(null);
    if (dialog.returnValue !== "unlocked") trigger?.focus({ preventScroll: true });
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (target?.closest("[data-lock-work]")) {
      unlocked = false;
      try { sessionStorage.removeItem(SESSION_KEY); } catch { /* Reload restores the locked HTML. */ }
      location.reload();
      return;
    }
    if (unlocked || event.defaultPrevented) return;
    const button = target?.closest("[data-unlock-work]");
    if (button) {
      const url = new URL(location.href);
      if (isHome(url.pathname)) url.hash = "work";
      requestAccess(url, button);
      return;
    }
    const link = target?.closest("a[href]");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href, location.href);
    if (!requiresAccess(url)) return;
    event.preventDefault();
    requestAccess(url, link);
  });

  function checkLocation() {
    const url = new URL(location.href);
    if (!unlocked && requiresAccess(url)) requestAccess(url);
  }

  window.addEventListener("hashchange", checkLocation);
  window.addEventListener("popstate", checkLocation);
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    try {
      // Back/Forward can restore mounted content after access was locked on
      // another page in this tab. Rebuild from the inert HTML in that case.
      if (unlocked !== (sessionStorage.getItem(SESSION_KEY) === "unlocked")) location.reload();
    } catch { /* Preserve the current document's memory fallback. */ }
  });
  if (unlocked) mountWork();
  else {
    document.documentElement.dataset.workAccess = "locked";
    mountHomepageListing();
  }
  document.addEventListener("DOMContentLoaded", () => {
    if (unlocked && location.hash) moveTo(new URL(location.href));
    else checkLocation();
  }, { once: true });
})();
