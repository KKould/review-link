(() => {
  const PR_PATH = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/([^/]*))?/;
  const FOCUS_MIN_SHARE = 0.2;
  const BADGE_PEOPLE = 3;
  const Settings = globalThis.ReviewLinkSettings;
  let settings = Settings.normalize();
  let t = Settings.translator(settings.languageId);

  const state = {
    prKey: null,
    pr: null,
    data: null,
    error: null,
    loading: false,
    focus: null,
    collapsed: false,
    position: null, // { left, top } in viewport pixels once the user drags the panel
    hashes: new Map(),
    activePath: null,
  };
  const dom = {};

  init();

  async function init() {
    const stored = await chrome.storage.local.get(["panelCollapsed", "panelPosition"]);
    state.collapsed = Boolean(stored.panelCollapsed);
    state.position = validPosition(stored.panelPosition);
    window.addEventListener("resize", throttleFrame(applyPosition));
    applySettings(await Settings.load());
    chrome.storage.onChanged.addListener(async (changes, area) => {
      if (area === "sync" && (changes.themeId || changes.languageId)) {
        applySettings(await Settings.load());
        render();
        clearBadges();
        decorateFiles();
      }
    });
    const observer = new MutationObserver(debounce(sync, 250));
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("turbo:load", sync);
    window.addEventListener("popstate", sync);
    window.addEventListener("scroll", throttleFrame(updateActiveFile), { passive: true });
    sync();
  }

  function sync() {
    const pr = parsePullRequest(location.pathname);
    if (!pr) {
      teardown();
      return;
    }
    const key = `${pr.owner}/${pr.repo}#${pr.number}`;
    if (key !== state.prKey) {
      Object.assign(state, { prKey: key, data: null, error: null, focus: null, activePath: null });
      state.hashes.clear();
      load(pr);
    }
    state.pr = pr;
    ensurePanel();
    decorateFiles();
  }

  function applySettings(next) {
    settings = next;
    t = Settings.translator(settings.languageId);
    // Badges live inside GitHub's diff headers, so the palette goes on the root element.
    Settings.applyTheme(document.documentElement, settings.themeId);
  }

  function parsePullRequest(pathname) {
    const match = PR_PATH.exec(pathname);
    if (!match) {
      return null;
    }
    const [, owner, repo, number, tab = ""] = match;
    return { owner, repo, number: Number(number), tab, base: `/${owner}/${repo}/pull/${number}` };
  }

  function load(pr, { force = false } = {}) {
    state.port?.disconnect();
    const key = state.prKey;
    const port = chrome.runtime.connect({ name: "review-link:analyze" });
    Object.assign(state, { port, loading: true, error: null, progress: null });
    clearBadges();
    render();

    const current = () => key === state.prKey && state.port === port;
    // Messages are applied one at a time; "start" awaits the diff anchor hashes.
    let queue = Promise.resolve();
    port.onMessage.addListener((message) => {
      queue = queue.then(() => (current() ? apply(message) : undefined)).catch(fail);
    });
    port.onDisconnect.addListener(() => {
      queue = queue.then(() => {
        if (current() && state.loading) {
          fail({ code: "error.disconnected", params: {} });
        }
      });
    });
    port.postMessage({ owner: pr.owner, repo: pr.repo, number: pr.number, force });

    async function apply(message) {
      if (message.type === "start") {
        state.data = { author: message.author, top: [], files: message.files };
        await Promise.all(message.files.map(async (file) => state.hashes.set(file.path, await diffId(file.path))));
        const total = message.files.filter((file) => file.status === "pending").length;
        state.progress = { done: 0, total };
        scheduleRender();
        decorateFiles();
      } else if (message.type === "file") {
        const index = state.data.files.findIndex((file) => file.path === message.file.path);
        if (index >= 0) {
          state.data.files[index] = message.file;
        }
        state.data.top = message.top;
        state.progress = { done: message.done, total: message.total };
        refreshBadge(message.file.path);
        scheduleRender();
      } else if (message.type === "done") {
        state.data.top = message.top;
        finish();
      } else if (message.type === "error") {
        fail(message.error);
      }
    }

    function fail(error) {
      if (!current()) {
        return;
      }
      state.error = error?.code ? error : { code: "error.unknown", params: { message: error?.message || String(error) } };
      // Keep what already arrived; mark the rest as not analyzed.
      for (const file of state.data?.files || []) {
        if (file.status === "pending") {
          file.status = "stopped";
        }
      }
      finish();
    }

    function finish() {
      state.loading = false;
      state.port = null;
      port.disconnect();
      render();
      clearBadges();
      decorateFiles();
    }
  }

  // Coalesces panel re-renders while results stream in.
  let renderPending = false;
  function scheduleRender() {
    if (renderPending) {
      return;
    }
    renderPending = true;
    requestAnimationFrame(() => {
      renderPending = false;
      render();
    });
  }

  function refreshBadge(path) {
    findFileContainer(path)?.querySelector(".review-link-badge")?.remove();
    decorateFiles();
  }

  // GitHub anchors every file in the diff as #diff-<sha256(path)>.
  async function diffId(path) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(path));
    const hex = [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `diff-${hex}`;
  }

  function teardown() {
    state.port?.disconnect();
    state.port = null;
    dom.panel?.remove();
    dom.panel = null;
    clearBadges();
    state.prKey = null;
  }

  function ensurePanel() {
    if (dom.panel?.isConnected) {
      return;
    }
    dom.panel = el("section", { id: "review-link-panel" });
    document.body.appendChild(dom.panel);
    render();
  }

  function render() {
    const panel = dom.panel;
    if (!panel) {
      return;
    }
    // Rebuilding the panel would reset the anchor list's scroll position.
    const listScroll = panel.querySelector(".review-link-anchors")?.scrollTop || 0;
    panel.replaceChildren();
    panel.classList.toggle("review-link-panel--collapsed", state.collapsed);
    if (state.collapsed) {
      const pill = button("review-link-pill", "Review Link", () => setCollapsed(false));
      pill.title = t("dragHint");
      makeDraggable(pill);
      panel.append(pill);
      applyPosition();
      return;
    }

    const ghost = "review-link-button review-link-button--ghost";
    const actions = el("div", { className: "review-link-panel__actions" }, [
      button(ghost, t("refresh"), () => state.pr && load(state.pr, { force: true })),
      button(ghost, t("settings"), () => chrome.runtime.sendMessage({ type: "review-link:open-options" })),
      button(ghost, t("collapse"), () => setCollapsed(true)),
    ]);
    const header = el("div", { className: "review-link-panel__header", title: t("dragHint") }, [
      el("div", { className: "review-link-panel__title", textContent: "Review Link" }),
      actions,
    ]);
    makeDraggable(header);
    header.addEventListener("dblclick", (event) => {
      if (!event.target.closest("button")) {
        resetPosition();
      }
    });
    panel.append(
      header,
      el("div", { className: "review-link-hint review-link-panel__subtitle", textContent: subtitle() })
    );
    if (state.loading) {
      const share = state.progress?.total ? state.progress.done / state.progress.total : 0;
      panel.append(
        el("div", { className: "review-link-progress" }, [
          el("span", { className: "review-link-progress__fill", style: `width:${(share * 100).toFixed(1)}%` }),
        ])
      );
    }

    if (state.error) {
      panel.append(el("div", { className: "review-link-error", textContent: errorText(state.error) }));
    }
    if (!state.data) {
      return;
    }
    panel.append(renderTop(), renderFileAnchors());
    const list = panel.querySelector(".review-link-anchors");
    if (list) {
      list.scrollTop = listScroll;
    }
    applyPosition();
  }

  // Dragging: the header (expanded) or the pill (collapsed) moves the panel. A press that
  // moves less than 4px stays a click, so the pill still expands and buttons still work.
  function makeDraggable(handle) {
    let suppressClick = false;
    handle.addEventListener(
      "click",
      (event) => {
        if (suppressClick) {
          suppressClick = false;
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      { capture: true }
    );
    handle.addEventListener("pointerdown", (event) => {
      const onButton = event.target.closest("button");
      if (event.button !== 0 || (onButton && onButton !== handle)) {
        return;
      }
      const panel = dom.panel;
      const rect = panel.getBoundingClientRect();
      const start = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      let moved = false;
      handle.setPointerCapture(event.pointerId);

      const onMove = (move) => {
        const dx = move.clientX - start.x;
        const dy = move.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) < 4) {
          return;
        }
        moved = true;
        panel.classList.add("review-link-panel--dragging");
        state.position = { left: start.left + dx, top: start.top + dy };
        applyPosition();
      };
      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        panel.classList.remove("review-link-panel--dragging");
        if (moved) {
          suppressClick = true;
          // Save where the panel actually stopped, not where the pointer went past the edge.
          state.position = { left: parseFloat(panel.style.left), top: parseFloat(panel.style.top) };
          chrome.storage.local.set({ panelPosition: state.position });
        }
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    });
  }

  // Keeps the whole panel inside the viewport; state.position keeps what the user chose,
  // so the panel moves back once the window grows again.
  function applyPosition() {
    const panel = dom.panel;
    if (!panel) {
      return;
    }
    if (!state.position) {
      panel.style.left = "";
      panel.style.top = "";
      panel.style.right = "";
      return;
    }
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - panel.offsetWidth - margin);
    const maxTop = Math.max(margin, window.innerHeight - panel.offsetHeight - margin);
    panel.style.left = `${Math.round(clamp(state.position.left, margin, maxLeft))}px`;
    panel.style.top = `${Math.round(clamp(state.position.top, margin, maxTop))}px`;
    panel.style.right = "auto";
  }

  function resetPosition() {
    state.position = null;
    applyPosition();
    chrome.storage.local.remove("panelPosition");
  }

  function validPosition(value) {
    return value && Number.isFinite(value.left) && Number.isFinite(value.top) ? { left: value.left, top: value.top } : null;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function errorText({ code, params = {} }) {
    const time = params.resetAt
      ? new Date(params.resetAt).toLocaleTimeString(settings.languageId === "zh" ? "zh-CN" : "en-US")
      : "";
    return t(code, { ...params, time, detail: params.detail || "—" });
  }

  function subtitle() {
    if (state.loading) {
      return state.progress?.total
        ? t("loadingProgress", { done: state.progress.done, total: state.progress.total })
        : t("loading");
    }
    if (!state.data) {
      return t("subtitleIdle");
    }
    return state.data.author ? t("subtitleAuthor", { author: state.data.author }) : t("subtitle");
  }

  function renderTop() {
    const section = el("div", { className: "review-link-section" }, [
      el("div", { className: "review-link-label", textContent: t("topTitle") }),
    ]);
    if (!state.data.top.length) {
      section.append(el("div", { className: "review-link-hint", textContent: state.loading ? t("loading") : t("noHistory") }));
      return section;
    }
    for (const [index, person] of state.data.top.entries()) {
      const row = button(
        `review-link-person${state.focus === person.login ? " review-link-person--active" : ""}`,
        null,
        () => toggleFocus(person.login)
      );
      row.title = state.focus === person.login ? t("unfocus") : t("focusPerson", { login: person.login });
      row.append(
        el("span", { className: "review-link-person__rank", textContent: String(index + 1) }),
        el("span", { className: "review-link-person__name", textContent: `@${person.login}` }),
        el("span", { className: "review-link-person__percent", textContent: percent(person.share) }),
        el("span", { className: "review-link-bar" }, [
          el("span", { className: "review-link-bar__fill", style: `width:${(person.share * 100).toFixed(1)}%` }),
        ])
      );
      section.append(row);
    }
    return section;
  }

  function renderFileAnchors() {
    const files = visibleFiles();
    const title = state.focus
      ? t("focusFilesTitle", { login: state.focus, count: files.length })
      : t("filesTitle", { count: files.length });
    const list = el("div", { className: "review-link-anchors" });
    for (const file of files) {
      const lead = file.shares[0];
      const focusShare = state.focus ? shareOf(file, state.focus) : null;
      const item = button(
        `review-link-anchor-item${file.path === state.activePath ? " review-link-anchor-item--active" : ""}`,
        null,
        () => jumpTo(file.path)
      );
      item.dataset.path = file.path;
      item.title = file.path;
      item.append(
        el("span", { className: "review-link-dot" }),
        el("span", { className: "review-link-anchor-item__path", textContent: shortPath(file.path) }),
        el("span", {
          className: "review-link-anchor-item__meta",
          textContent:
            file.status === "pending"
              ? "…"
              : focusShare != null
                ? percent(focusShare)
                : lead
                  ? `@${lead.login} ${percent(lead.share)}`
                  : "—",
        })
      );
      list.append(item);
    }
    return el("div", { className: "review-link-section" }, [
      el("div", { className: "review-link-label", textContent: title }),
      list,
    ]);
  }

  function visibleFiles() {
    const files = state.data?.files || [];
    if (!state.focus) {
      return files;
    }
    return files
      .filter((file) => isFocusFile(file, state.focus))
      .sort((a, b) => shareOf(b, state.focus) - shareOf(a, state.focus));
  }

  function decorateFiles() {
    if (!state.data) {
      return;
    }
    for (const file of state.data.files) {
      const container = findFileContainer(file.path);
      if (!container) {
        continue;
      }
      container.classList.toggle("review-link-file--focus", Boolean(state.focus) && isFocusFile(file, state.focus));
      container.classList.toggle("review-link-file--dim", Boolean(state.focus) && !isFocusFile(file, state.focus));
      if (container.querySelector(":scope .review-link-badge")) {
        continue;
      }
      const badge = renderBadge(file);
      // GitHub's newer diff view: put the badge right after the file name, before the
      // toolbar, so it stays visible next to the path instead of at the far right.
      const reactHeader = container.querySelector("[class*='diff-file-header']");
      const nameBlock = reactHeader?.querySelector("h3")?.parentElement;
      if (nameBlock && nameBlock.parentElement === reactHeader) {
        badge.classList.add("review-link-badge--inline");
        nameBlock.after(badge);
        continue;
      }
      const header =
        container.querySelector(".file-header .file-info") ||
        container.querySelector(".file-header") ||
        reactHeader ||
        container.querySelector("[class*='DiffFileHeader']") ||
        container.firstElementChild ||
        container;
      header.append(badge);
    }
  }

  function findFileContainer(path) {
    const id = state.hashes.get(path);
    const escaped = CSS.escape(path);
    return (
      (id && document.getElementById(id)) ||
      document.querySelector(`[data-tagsearch-path="${escaped}"]`) ||
      document.querySelector(`[data-file-path="${escaped}"]`)
    );
  }

  // WebEcho-style anchor: dot, connector line, then a bubble with the people.
  function renderBadge(file) {
    const bubble = el("span", { className: "review-link-bubble" });
    if (file.status !== "ok") {
      bubble.append(el("span", { className: "review-link-bubble__muted", textContent: file.status ? t(`status.${file.status}`) : "—" }));
    } else {
      const shown = file.shares.slice(0, BADGE_PEOPLE);
      for (const person of shown) {
        const chip = button("review-link-chip", `@${person.login} ${percent(person.share)}`, () => toggleFocus(person.login));
        chip.classList.toggle("review-link-chip--active", state.focus === person.login);
        bubble.append(chip);
      }
      const rest = 1 - shown.reduce((sum, person) => sum + person.share, 0);
      if (rest >= 0.005) {
        bubble.append(el("span", { className: "review-link-bubble__muted", textContent: t("others", { percent: percent(rest) }) }));
      }
    }
    const badge = el("span", { className: "review-link-badge", title: t("badgeTitle") }, [
      el("span", { className: "review-link-dot" }),
      el("span", { className: "review-link-connector" }),
      bubble,
    ]);
    badge.classList.toggle("review-link-badge--pending", file.status === "pending");
    if (file.status === "ok") {
      badge.classList.add("review-link-badge--enter");
    }
    // Keep clicks from toggling or collapsing GitHub's file header.
    badge.addEventListener("click", (event) => event.stopPropagation());
    return badge;
  }

  function clearBadges() {
    document.querySelectorAll(".review-link-badge").forEach((node) => node.remove());
    document
      .querySelectorAll(".review-link-file--focus, .review-link-file--dim")
      .forEach((node) => node.classList.remove("review-link-file--focus", "review-link-file--dim"));
  }

  function toggleFocus(login) {
    state.focus = state.focus === login ? null : login;
    render();
    clearBadges();
    decorateFiles();
    const first = visibleFiles()[0];
    if (state.focus && first && findFileContainer(first.path)) {
      jumpTo(first.path);
    }
  }

  function jumpTo(path) {
    if (!state.pr) {
      return;
    }
    const id = state.hashes.get(path);
    const container = findFileContainer(path);
    if (container) {
      container.scrollIntoView({ behavior: "smooth", block: "start" });
      if (id) {
        history.replaceState(history.state, "", `#${id}`);
      }
      setActive(path);
      return;
    }
    // Not on the diff tab, or GitHub has not rendered that file yet: let GitHub resolve the hash.
    const onDiffTab = state.pr && (state.pr.tab === "files" || state.pr.tab === "changes");
    const target = onDiffTab ? location.pathname : `${state.pr.base}/files`;
    location.assign(`${target}${id ? `#${id}` : ""}`);
  }

  function updateActiveFile() {
    if (!state.data || !dom.panel) {
      return;
    }
    let current = null;
    for (const file of state.data.files) {
      const container = findFileContainer(file.path);
      if (container && container.getBoundingClientRect().top <= 140) {
        current = file.path;
      }
    }
    if (current) {
      setActive(current);
    }
  }

  function setActive(path) {
    if (state.activePath === path) {
      return;
    }
    state.activePath = path;
    dom.panel?.querySelectorAll(".review-link-anchor-item").forEach((item) => {
      const active = item.dataset.path === path;
      item.classList.toggle("review-link-anchor-item--active", active);
      if (active) {
        keepVisible(item);
      }
    });
  }

  // Scroll only the anchor list, never the page.
  function keepVisible(item) {
    const list = item.parentElement;
    if (!list) {
      return;
    }
    if (item.offsetTop < list.scrollTop) {
      list.scrollTop = item.offsetTop;
    } else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
    }
  }

  async function setCollapsed(collapsed) {
    state.collapsed = collapsed;
    render();
    await chrome.storage.local.set({ panelCollapsed: collapsed });
  }

  function isFocusFile(file, login) {
    return file.shares[0]?.login === login || shareOf(file, login) >= FOCUS_MIN_SHARE;
  }

  function shareOf(file, login) {
    return file.shares.find((person) => person.login === login)?.share || 0;
  }

  function percent(share) {
    return `${Math.round(share * 100)}%`;
  }

  function shortPath(path) {
    const parts = path.split("/");
    return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : path;
  }

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === "className" || key === "textContent" || key === "id" || key === "title") {
        node[key] = value;
      } else {
        node.setAttribute(key, value);
      }
    }
    node.append(...children);
    return node;
  }

  function button(className, text, onClick) {
    const node = el("button", { type: "button", className });
    if (text != null) {
      node.textContent = text;
    }
    node.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return node;
  }

  function debounce(fn, wait) {
    let timer = null;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }

  function throttleFrame(fn) {
    let pending = false;
    return () => {
      if (pending) {
        return;
      }
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        fn();
      });
    };
  }
})();
