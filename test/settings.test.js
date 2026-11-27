import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadSettings(language = "en-US") {
  const context = { navigator: { language }, chrome: {} };
  context.globalThis = context;
  vm.runInNewContext(readFileSync(new URL("../src/settings.js", import.meta.url), "utf8"), context);
  return context.ReviewLinkSettings;
}

const extractKeys = (source) => new Set([...source.matchAll(/\bt\(\s*"([^"]+)"/g)].map((match) => match[1]));

test("every theme defines the same palette keys and has labels", () => {
  const { THEMES, THEME_LABELS } = loadSettings();
  const [first, ...rest] = Object.values(THEMES);
  for (const theme of rest) {
    assert.deepEqual(Object.keys(theme).sort(), Object.keys(first).sort());
  }
  assert.deepEqual(Object.keys(THEME_LABELS).sort(), Object.keys(THEMES).sort());
});

test("Chinese and English cover every message used by the extension", () => {
  const { translator } = loadSettings();
  const zh = translator("zh");
  const en = translator("en");
  const used = new Set([
    ...extractKeys(readFileSync(new URL("../src/content-script.js", import.meta.url), "utf8")),
    ...[...readFileSync(new URL("../src/options.html", import.meta.url), "utf8").matchAll(/data-i18n="([^"]+)"/g)].map(
      (match) => match[1]
    ),
    ...["../src/service-worker.js", "../src/github-errors.js"].flatMap((file) =>
      [...readFileSync(new URL(file, import.meta.url), "utf8").matchAll(/"(error\.[\w]+)"/g)].map((match) => match[1])
    ),
    ...["ignored", "no-history", "skipped"].map((status) => `status.${status}`),
  ]);
  for (const key of used) {
    assert.notEqual(zh(key), key, `zh missing ${key}`);
    assert.notEqual(en(key), key, `en missing ${key}`);
    if (key !== "tokenLabel") {
      assert.notEqual(zh(key), en(key), `zh not translated: ${key}`);
    }
  }
});

test("translator fills parameters and defaults follow the browser language", () => {
  assert.equal(loadSettings("en-US").translator("en")("filesTitle", { count: 3 }), "File anchors (3)");
  assert.equal(loadSettings("zh-CN").normalize({}).languageId, "zh");
  assert.equal(loadSettings("en-US").normalize({ themeId: "tide" }).themeId, "dark");
});
