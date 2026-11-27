const Settings = globalThis.ReviewLinkSettings;
const tokenInput = document.getElementById("token");
const languageSelect = document.getElementById("language");
const themeList = document.getElementById("themes");
const status = document.getElementById("status");
let current = Settings.normalize();

init();

async function init() {
  current = await Settings.load();
  for (const { id, label } of Settings.LANGUAGES) {
    languageSelect.append(new Option(label, id));
  }
  languageSelect.addEventListener("change", () => update({ languageId: languageSelect.value }));
  const { githubToken } = await chrome.storage.local.get("githubToken");
  tokenInput.value = githubToken || "";
  render();
}

// Appearance applies immediately; open GitHub tabs follow through storage.onChanged.
async function update(patch) {
  current = { ...current, ...patch };
  await chrome.storage.sync.set(current);
  status.textContent = "";
  render();
}

function render() {
  const t = Settings.translator(current.languageId);
  Settings.applyTheme(document.documentElement, current.themeId);
  document.documentElement.lang = current.languageId === "zh" ? "zh-CN" : "en";
  document.title = t("optionsTitle");
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  languageSelect.value = current.languageId;

  themeList.replaceChildren();
  for (const [id, theme] of Object.entries(Settings.THEMES)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme";
    button.setAttribute("aria-pressed", String(id === current.themeId));
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = theme.panelBg;
    const name = document.createElement("span");
    name.textContent = Settings.THEME_LABELS[id][current.languageId] || id;
    button.append(swatch, name);
    button.addEventListener("click", () => update({ themeId: id }));
    themeList.append(button);
  }
}

document.getElementById("save").addEventListener("click", async () => {
  const t = Settings.translator(current.languageId);
  const token = tokenInput.value.trim();
  await chrome.storage.local.set({ githubToken: token });
  status.textContent = token ? t("saved") : t("savedEmpty");
});

document.getElementById("clear").addEventListener("click", async () => {
  const t = Settings.translator(current.languageId);
  await chrome.storage.local.remove("githubToken");
  tokenInput.value = "";
  status.textContent = t("cleared");
});
