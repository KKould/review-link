// Renders icons/icon-{16,32,48,128}.png (and .svg sources) with headless Chrome over CDP.
// Usage: node scripts/icons.mjs [path-to-chrome]   (or set CHROME)
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { iconSvg } from "./icon.svg.js";

const SIZES = [16, 32, 48, 128];
// Chrome Web Store asks for 16px of transparent padding on the 128px icon.
const PAD = { 16: 0, 32: 0, 48: 4, 128: 16 };

const chromePath = process.argv[2] || process.env.CHROME || "google-chrome";
const root = new URL("..", import.meta.url).pathname;
const out = join(root, "icons");
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "review-link-icons-"));

const chrome = spawn(
  chromePath,
  ["--headless=new", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"],
  { stdio: ["ignore", "ignore", "pipe"] }
);

try {
  const browserUrl = await new Promise((resolve, reject) => {
    let log = "";
    chrome.stderr.on("data", (chunk) => {
      log += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(log);
      if (match) resolve(match[1]);
    });
    chrome.on("exit", (code) => reject(new Error(`Chrome exited (${code}): ${log}`)));
  });
  const port = new URL(browserUrl).port;
  const [page] = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((t) => t.type === "page");
  const cdp = await connect(page.webSocketDebuggerUrl);

  await cdp("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  for (const size of SIZES) {
    const svg = iconSvg({ size, pad: PAD[size] });
    writeFileSync(join(out, `icon-${size}.svg`), svg);
    await cdp("Emulation.setDeviceMetricsOverride", { width: 256, height: 256, deviceScaleFactor: 1, mobile: false });
    const frameId = (await cdp("Page.getFrameTree")).frameTree.frame.id;
    await cdp("Page.setDocumentContent", {
      frameId,
      html: `<html><body style="margin:0;background:transparent">${svg}</body></html>`,
    });
    const { data } = await cdp("Page.captureScreenshot", {
      format: "png",
      clip: { x: 0, y: 0, width: size, height: size, scale: 1 },
    });
    writeFileSync(join(out, `icon-${size}.png`), Buffer.from(data, "base64"));
    console.log(`icons/icon-${size}.png`);
  }
} finally {
  chrome.kill();
  await new Promise((resolve) => (chrome.exitCode !== null ? resolve() : chrome.on("exit", resolve)));
  rmSync(profile, { recursive: true, force: true });
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    const handlers = pending.get(msg.id);
    if (!handlers) return;
    pending.delete(msg.id);
    if (msg.error) handlers.reject(new Error(`${handlers.method}: ${msg.error.message} ${msg.error.data || ""}`));
    else handlers.resolve(msg.result);
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject, method });
      ws.send(JSON.stringify({ id, method, params }));
    });
}
