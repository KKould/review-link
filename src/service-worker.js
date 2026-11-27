import { describeFailure } from "./github-errors.js";
import { fileShares, isIgnoredPath, prShares } from "./relevance.js";

const API = "https://api.github.com";
const MAX_FILES = 100;
const HISTORY_DEPTH = 50;
const CONCURRENCY = 4;
const memoryCache = new Map();

// Streaming analysis over a port, so the page can show each file as soon as it is done:
//   -> { owner, repo, number, force }
//   <- { type: "start", author, files }            every file; analyzable ones are "pending"
//   <- { type: "file", file, top, done, total }    one per analyzed file, largest change first
//   <- { type: "done", top } | { type: "error", error }
// Closing the port (navigation, refresh) stops the remaining requests.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "review-link:analyze") {
    return;
  }
  let closed = false;
  port.onDisconnect.addListener(() => {
    closed = true;
  });
  const emit = (message) => {
    if (!closed) port.postMessage(message);
  };
  port.onMessage.addListener((request) => {
    streamPullRequest(request, emit, () => closed).catch((error) => emit({ type: "error", error: toWireError(error) }));
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "review-link:open-options") {
    chrome.runtime.openOptionsPage();
  }
  return false;
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

async function streamPullRequest({ owner, repo, number, force = false }, emit, isClosed) {
  const key = `${owner}/${repo}#${number}`;
  const [pr, files] = await Promise.all([github(`/repos/${owner}/${repo}/pulls/${number}`), listFiles(owner, repo, number)]);
  const cacheKey = `${key}@${pr.base.sha}..${pr.head.sha}`;
  if (force) {
    memoryCache.delete(cacheKey);
  }
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    emit({ type: "start", author: cached.author, files: cached.files });
    emit({ type: "done", top: cached.top });
    return;
  }

  const author = pr.user?.login;
  const exclude = author ? [author] : [];
  const ranked = files.filter((file) => !isIgnoredPath(file.filename)).sort((a, b) => b.changes - a.changes);
  const analyzed = new Set(ranked.slice(0, MAX_FILES).map((file) => file.filename));
  const results = files.map((file) => ({
    path: file.filename,
    changes: file.changes,
    shares: [],
    status: isIgnoredPath(file.filename) ? "ignored" : analyzed.has(file.filename) ? "pending" : "skipped",
  }));
  emit({ type: "start", author, files: results });

  const order = results
    .map((file, index) => index)
    .filter((index) => results[index].status === "pending")
    .sort((a, b) => results[b].changes - results[a].changes);
  let done = 0;
  await mapLimit(order, CONCURRENCY, isClosed, async (index) => {
    const file = files[index];
    const historyPath = file.status === "renamed" && file.previous_filename ? file.previous_filename : file.filename;
    const commits = await history(owner, repo, pr.base.sha, historyPath);
    const shares = fileShares(commits, { exclude });
    results[index] = { ...results[index], shares, status: shares.length ? "ok" : "no-history" };
    done += 1;
    emit({ type: "file", file: results[index], top: prShares(results), done, total: order.length });
  });
  if (isClosed()) {
    return;
  }

  const data = { author, baseSha: pr.base.sha, top: prShares(results), files: results };
  memoryCache.set(cacheKey, data);
  emit({ type: "done", top: data.top });
}

async function listFiles(owner, repo, number) {
  const files = [];
  for (let page = 1; page <= 30; page += 1) {
    const batch = await github(`/repos/${owner}/${repo}/pulls/${number}/files?per_page=100&page=${page}`);
    files.push(...batch);
    if (batch.length < 100) {
      break;
    }
  }
  return files;
}

async function history(owner, repo, sha, path) {
  const storageKey = `history:${owner}/${repo}@${sha}:${path}`;
  const stored = await chrome.storage.session.get(storageKey);
  if (stored[storageKey]) {
    return stored[storageKey];
  }
  const query = new URLSearchParams({ sha, path, per_page: String(HISTORY_DEPTH) });
  const commits = await github(`/repos/${owner}/${repo}/commits?${query}`);
  // Keep only the fields scoring needs; session storage is limited.
  const slim = commits.map((item) => ({
    author: item.author ? { login: item.author.login, type: item.author.type } : null,
    commit: { committer: { date: item.commit?.committer?.date } },
  }));
  await chrome.storage.session.set({ [storageKey]: slim }).catch(() => {});
  return slim;
}

async function github(path) {
  const { githubToken } = await chrome.storage.local.get("githubToken");
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }
  const response = await fetch(`${API}${path}`, { headers });
  if (response.ok) {
    return response.json();
  }
  const body = await response.text().catch(() => "");
  const { code, params } = describeFailure({ status: response.status, headers: response.headers, body, hasToken: Boolean(githubToken) });
  throw new ReviewLinkError(code, params);
}

// Carries a message key so the page can show it in the user's language.
class ReviewLinkError extends Error {
  constructor(code, params = {}) {
    super(code);
    this.code = code;
    this.params = params;
  }
}

function toWireError(error) {
  if (error instanceof ReviewLinkError) {
    return { code: error.code, params: error.params };
  }
  return { code: "error.unknown", params: { message: error?.message || String(error) } };
}

// Runs fn over items with at most `limit` in flight. Stops starting new items once
// `shouldStop()` is true or any item fails; rejects with the first failure.
async function mapLimit(items, limit, shouldStop, fn) {
  let next = 0;
  let failed = false;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && !failed && !shouldStop()) {
      const item = items[next];
      next += 1;
      try {
        await fn(item);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  });
  await Promise.all(workers);
}
