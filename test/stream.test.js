import assert from "node:assert/strict";
import test from "node:test";

// Loads the real service worker with stubbed chrome.* and fetch, then talks to it
// through a fake port exactly like the content script does.
const listeners = {};
const session = new Map();
globalThis.chrome = {
  runtime: {
    onConnect: { addListener: (fn) => (listeners.connect = fn) },
    onMessage: { addListener: () => {} },
    openOptionsPage: () => {},
  },
  action: { onClicked: { addListener: () => {} } },
  storage: {
    local: { get: async () => ({}) },
    session: {
      get: async (key) => (session.has(key) ? { [key]: session.get(key) } : {}),
      set: async (entries) => Object.entries(entries).forEach(([k, v]) => session.set(k, v)),
    },
  },
};

const FILES = [
  { filename: "small.rs", changes: 5, status: "modified" },
  { filename: "big.rs", changes: 300, status: "modified" },
  { filename: "Cargo.lock", changes: 900, status: "modified" },
  { filename: "medium.rs", changes: 40, status: "modified" },
  { filename: "broken.rs", changes: 20, status: "modified" },
];
let requests = [];
let failPath = null;
let delay = 0;
globalThis.fetch = async (url) => {
  const { pathname, searchParams } = new URL(url);
  requests.push(pathname + (searchParams.get("path") ? `?path=${searchParams.get("path")}` : ""));
  await new Promise((resolve) => setTimeout(resolve, delay));
  const json = (body, status = 200, headers = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
  if (pathname.endsWith("/pulls/1")) {
    return json({ base: { sha: "base" }, head: { sha: `head-${Math.random()}` }, user: { login: "author" } });
  }
  if (pathname.endsWith("/pulls/1/files")) {
    return json(FILES);
  }
  if (pathname.endsWith("/commits")) {
    const path = searchParams.get("path");
    if (path === failPath) {
      return json({ message: "API rate limit exceeded" }, 403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1800000000" });
    }
    const login = path.replace(".rs", "");
    return json([{ author: { login, type: "User" }, commit: { committer: { date: new Date().toISOString() } } }]);
  }
  return json({ message: "Not Found" }, 404);
};

await import("../src/service-worker.js");

function connect(request) {
  const messages = [];
  let resolveFinished;
  const finished = new Promise((resolve) => (resolveFinished = resolve));
  const port = {
    name: "review-link:analyze",
    disconnectListeners: [],
    messageListeners: [],
    onDisconnect: { addListener: (fn) => port.disconnectListeners.push(fn) },
    onMessage: { addListener: (fn) => port.messageListeners.push(fn) },
    // Real ports serialize at send time; copy so later mutations don't leak into earlier messages.
    postMessage: (message) => {
      messages.push(structuredClone(message));
      if (message.type === "done" || message.type === "error") resolveFinished();
    },
    close: () => port.disconnectListeners.forEach((fn) => fn()),
  };
  listeners.connect(port);
  port.messageListeners.forEach((fn) => fn(request));
  return { port, messages, finished };
}

test("streams start, then one message per file from the largest change, then done", async () => {
  failPath = null;
  session.clear();
  requests = [];
  const { messages, finished } = connect({ owner: "o", repo: "r", number: 1 });
  await finished;

  assert.equal(messages[0].type, "start");
  assert.equal(messages[0].author, "author");
  assert.deepEqual(
    messages[0].files.map((f) => [f.path, f.status]),
    [
      ["small.rs", "pending"],
      ["big.rs", "pending"],
      ["Cargo.lock", "ignored"],
      ["medium.rs", "pending"],
      ["broken.rs", "pending"],
    ]
  );
  const fileMessages = messages.filter((m) => m.type === "file");
  assert.equal(fileMessages.length, 4);
  assert.deepEqual(
    fileMessages.map((m) => m.done),
    [1, 2, 3, 4]
  );
  assert.ok(fileMessages.every((m) => m.total === 4));
  // Started largest first (4 workers, so all start at once; order of starts follows size).
  assert.deepEqual(
    requests.filter((r) => r.includes("?path=")).map((r) => r.split("=")[1]),
    ["big.rs", "medium.rs", "broken.rs", "small.rs"]
  );
  const done = messages.at(-1);
  assert.equal(done.type, "done");
  assert.deepEqual(done.top, fileMessages.at(-1).top);
  assert.equal(done.top[0].login, "big");
});

test("a failure mid-way keeps earlier results and ends with an error", async () => {
  failPath = "medium.rs";
  session.clear();
  requests = [];
  const { messages, finished } = connect({ owner: "o", repo: "r", number: 1 });
  await finished;
  const types = messages.map((m) => m.type);
  assert.equal(types[0], "start");
  assert.ok(types.includes("file"), "files finished before the failure are still sent");
  const error = messages.find((m) => m.type === "error");
  assert.equal(error.error.code, "error.rateLimitNoToken"); // the stub has no token
  assert.ok(!types.includes("done"));
});

test("closing the port stops starting new requests", async () => {
  failPath = null;
  session.clear();
  delay = 30;
  requests = [];
  const many = Array.from({ length: 20 }, (_, i) => ({ filename: `f${i}.rs`, changes: 100 - i, status: "modified" }));
  FILES.splice(0, FILES.length, ...many);
  const { port, messages } = connect({ owner: "o", repo: "r", number: 1, force: true });
  await new Promise((resolve) => setTimeout(resolve, 45));
  port.close();
  await new Promise((resolve) => setTimeout(resolve, 300));
  const historyRequests = requests.filter((r) => r.includes("?path=")).length;
  assert.ok(historyRequests <= 8, `expected requests to stop after closing, got ${historyRequests}`);
  assert.ok(!messages.some((m) => m.type === "done"));
  delay = 0;
});
