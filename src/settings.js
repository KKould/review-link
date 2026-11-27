// Shared by the content script and the options page (loaded as a classic script).
// Two monochrome palettes in WebEcho's layout style.
(() => {
  const THEMES = {
    dark: {
      scheme: "dark",
      panelBg: "rgba(14, 14, 16, 0.94)",
      text: "#f5f5f5",
      muted: "#b4b4b4",
      accent: "#e8e8e8",
      border: "#4a4a4a",
      buttonBg: "#262626",
      primaryStart: "#5a5a5a",
      primaryEnd: "#2a2a2a",
      inputBg: "rgba(255, 255, 255, 0.08)",
      hoverBg: "rgba(255, 255, 255, 0.1)",
      bubbleBorder: "rgba(255, 255, 255, 0.45)",
      bubbleText: "#ffffff",
      activeBg: "rgba(255, 255, 255, 0.14)",
      activeBorder: "rgba(255, 255, 255, 0.55)",
      pageStart: "#2a2a2a",
      pageEnd: "#0a0a0a",
    },
    light: {
      scheme: "light",
      panelBg: "rgba(255, 255, 255, 0.96)",
      text: "#1a1a1a",
      muted: "#5c5c5c",
      accent: "#111111",
      border: "#d0d0d0",
      buttonBg: "#f2f2f2",
      primaryStart: "#bdbdbd",
      primaryEnd: "#e6e6e6",
      inputBg: "rgba(0, 0, 0, 0.05)",
      hoverBg: "rgba(0, 0, 0, 0.06)",
      bubbleBorder: "rgba(0, 0, 0, 0.35)",
      bubbleText: "#111111",
      activeBg: "rgba(0, 0, 0, 0.07)",
      activeBorder: "rgba(0, 0, 0, 0.45)",
      pageStart: "#ffffff",
      pageEnd: "#e8e8e8",
    },
  };

  const THEME_LABELS = {
    dark: { en: "Black", zh: "黑色" },
    light: { en: "White", zh: "白色" },
  };

  const LANGUAGES = [
    { id: "zh", label: "中文" },
    { id: "en", label: "English" },
  ];

  const MESSAGES = {
    zh: {
      refresh: "刷新",
      collapse: "收起",
      settings: "设置",
      loading: "正在分析修改历史…",
      subtitleIdle: "按文件修改历史估算相关度",
      subtitle: "按修改历史估算",
      subtitleAuthor: "按修改历史估算 · 已排除作者 @{author}",
      topTitle: "变更相关度 Top 5",
      noHistory: "没有可用的修改历史。",
      filesTitle: "文件锚点 ({count})",
      focusFilesTitle: "@{login} 相关的文件 ({count})",
      focusPerson: "只高亮 @{login} 相关的文件",
      unfocus: "取消聚焦",
      others: "其他 {percent}",
      badgeTitle: "Review Link：按修改历史估算的相关度",
      "status.ignored": "已忽略：锁文件或生成文件",
      "status.no-history": "新文件，暂无修改历史",
      "status.skipped": "文件过多，未分析",
      "error.rateLimit": "GitHub API 额度已用完，{time} 恢复。",
      "error.rateLimitNoToken": "GitHub API 额度已用完，{time} 恢复。在设置里填 token 可提高额度。",
      "error.notFound": "找不到这个 PR。私有仓库需要在设置里填 GitHub token。",
      "error.badToken": "GitHub token 无效或已过期，请在设置里更新。",
      "error.http": "GitHub API 返回 {status}。",
      "error.unknown": "分析失败：{message}",
      optionsTitle: "Review Link 设置",
      appearance: "外观",
      language: "语言",
      theme: "主题",
      tokenLabel: "GitHub token",
      tokenHelp:
        "不填 token 时只能读公开仓库，每小时约 60 次请求，大一点的 PR 会很快用完。建议用 fine-grained token，只给目标仓库的 Contents 和 Pull requests 只读权限。token 只保存在本机浏览器里。",
      save: "保存",
      clear: "清除",
      saved: "已保存。",
      savedEmpty: "已保存，未设置 token。",
      cleared: "已清除。",
    },

    en: {
      refresh: "Refresh",
      collapse: "Hide",
      settings: "Settings",
      loading: "Analyzing change history…",
      subtitleIdle: "Relevance from each file's change history",
      subtitle: "Estimated from change history",
      subtitleAuthor: "From change history · author @{author} excluded",
      topTitle: "Top 5 by change relevance",
      noHistory: "No usable change history.",
      filesTitle: "File anchors ({count})",
      focusFilesTitle: "Files related to @{login} ({count})",
      focusPerson: "Highlight files related to @{login}",
      unfocus: "Clear focus",
      others: "Others {percent}",
      badgeTitle: "Review Link: relevance estimated from change history",
      "status.ignored": "Ignored: lock or generated file",
      "status.no-history": "New file, no history yet",
      "status.skipped": "Too many files, not analyzed",
      "error.rateLimit": "GitHub API rate limit reached. Resets at {time}.",
      "error.rateLimitNoToken": "GitHub API rate limit reached. Resets at {time}. Add a token in Settings for a higher limit.",
      "error.notFound": "Pull request not found. Private repositories need a GitHub token in Settings.",
      "error.badToken": "The GitHub token is invalid or expired. Update it in Settings.",
      "error.http": "GitHub API returned {status}.",
      "error.unknown": "Analysis failed: {message}",
      optionsTitle: "Review Link settings",
      appearance: "Appearance",
      language: "Language",
      theme: "Theme",
      tokenLabel: "GitHub token",
      tokenHelp:
        "Without a token only public repositories work, at about 60 requests per hour, which a large PR uses up quickly. Use a fine-grained token with read-only Contents and Pull requests access to the repositories you review. The token is stored only in this browser.",
      save: "Save",
      clear: "Clear",
      saved: "Saved.",
      savedEmpty: "Saved without a token.",
      cleared: "Cleared.",
    },
  };

  const DEFAULTS = {
    themeId: "dark",
    languageId: /^zh\b/i.test(navigator.language || "") ? "zh" : "en",
  };

  function normalize(stored = {}) {
    return {
      themeId: THEMES[stored.themeId] ? stored.themeId : DEFAULTS.themeId,
      languageId: MESSAGES[stored.languageId] ? stored.languageId : DEFAULTS.languageId,
    };
  }

  async function load() {
    return normalize(await chrome.storage.sync.get(["themeId", "languageId"]));
  }

  function translator(languageId) {
    const table = MESSAGES[languageId] || MESSAGES.en;
    return (key, params = {}) =>
      (table[key] ?? MESSAGES.en[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
  }

  // Exposes the palette as --rl-* custom properties on `target`.
  function applyTheme(target, themeId) {
    const theme = THEMES[themeId] || THEMES[DEFAULTS.themeId];
    for (const [name, value] of Object.entries(theme)) {
      target.style.setProperty(`--rl-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value);
    }
  }

  globalThis.ReviewLinkSettings = { THEMES, THEME_LABELS, LANGUAGES, load, normalize, translator, applyTheme };
})();
