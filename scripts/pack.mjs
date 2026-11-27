// Builds dist/review-link-<version>.zip for the Chrome Web Store, plus the same files
// unpacked in dist/review-link-<version>/ (the input for scripts/crx.mjs).
// It checks the manifest first and fails on anything the store would reject.
// Usage: node scripts/pack.mjs
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";
import { readPng } from "./png.mjs";

const root = new URL("..", import.meta.url).pathname;
// Only these paths ship. Tests, scripts, docs and repo files stay out of the zip.
const INCLUDE = ["manifest.json", "_locales", "icons", "src"];
const EXCLUDE = [/\.svg$/, /(^|\/)\./];
const DESCRIPTION_LIMIT = 132;

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const errors = [];
check(manifest);
if (errors.length) {
  console.error(`Cannot pack:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  process.exit(1);
}

const files = INCLUDE.flatMap((entry) => walk(join(root, entry)))
  .map((path) => relative(root, path).split(sep).join("/"))
  .filter((path) => !EXCLUDE.some((pattern) => pattern.test(path)))
  .sort();
mkdirSync(join(root, "dist"), { recursive: true });
const target = join(root, "dist", `review-link-${manifest.version}.zip`);
writeFileSync(target, zip(files.map((path) => ({ path, data: readFileSync(join(root, path)) }))));
console.log(`${relative(root, target)} (${files.length} files)`);
for (const path of files) console.log(`  ${path}`);

const staged = join(root, "dist", `review-link-${manifest.version}`);
rmSync(staged, { recursive: true, force: true });
for (const path of files) {
  mkdirSync(dirname(join(staged, path)), { recursive: true });
  cpSync(join(root, path), join(staged, path));
}
console.log(`${relative(root, staged)}/ (same files, unpacked)`);

function check(m) {
  if (m.manifest_version !== 3) errors.push("manifest_version must be 3");
  if (!/^\d+(\.\d+){0,3}$/.test(m.version || "")) errors.push(`invalid version "${m.version}"`);

  const locales = existsSync(join(root, "_locales")) ? readdirSync(join(root, "_locales")) : [];
  if (m.default_locale && !locales.includes(m.default_locale)) {
    errors.push(`default_locale "${m.default_locale}" has no _locales folder`);
  }
  const messageRefs = JSON.stringify(m).match(/__MSG_\w+__/g) || [];
  for (const locale of locales) {
    const messages = JSON.parse(readFileSync(join(root, "_locales", locale, "messages.json"), "utf8"));
    for (const ref of messageRefs) {
      const key = ref.slice(6, -2);
      if (!messages[key]?.message) errors.push(`_locales/${locale} is missing "${key}"`);
    }
    const description = messages.extDescription?.message || "";
    if ([...description].length > DESCRIPTION_LIMIT) {
      errors.push(`_locales/${locale} description is ${[...description].length} chars (max ${DESCRIPTION_LIMIT})`);
    }
  }

  for (const [size, path] of Object.entries({ ...m.icons, ...m.action?.default_icon })) {
    const full = join(root, path);
    if (!existsSync(full)) {
      errors.push(`missing icon ${path}`);
      continue;
    }
    const png = readPng(full);
    if (png.width !== Number(size) || png.height !== Number(size)) {
      errors.push(`${path} is ${png.width}x${png.height}, expected ${size}x${size}`);
    }
  }
  if (!m.icons?.["128"]) errors.push("a 128x128 icon is required");

  const referenced = [
    m.background?.service_worker,
    m.options_page,
    ...(m.content_scripts || []).flatMap((script) => [...(script.js || []), ...(script.css || [])]),
  ].filter(Boolean);
  for (const path of referenced) {
    if (!existsSync(join(root, path))) errors.push(`manifest references missing file ${path}`);
  }
}

function walk(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => walk(join(path, name)));
}

// Plain zip writer (deflate, no zip64); enough for a small extension package.
function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  // Fixed timestamp keeps the zip byte-identical across runs: 2026-01-01 00:00.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const { path, data } of entries) {
    const name = Buffer.from(path, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6); // UTF-8 names
    header.writeUInt16LE(8, 8); // deflate
    header.writeUInt16LE(dosTime, 10);
    header.writeUInt16LE(dosDate, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, compressed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(dosTime, 12);
    entry.writeUInt16LE(dosDate, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(compressed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += header.length + name.length + compressed.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}
