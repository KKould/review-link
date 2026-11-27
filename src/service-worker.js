import { describeFailure } from "./github-errors.js";
import { fileShares, isIgnoredPath, prShares } from "./relevance.js";

const API = "https://api.github.com";
const MAX_FILES = 100;
const HISTORY_DEPTH = 50;
const CONCURRENCY = 4;
const memoryCache = new Map();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "review-link:analyze") {
    return false;
  }
  analyzePullRequest(message.payload)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: toWireError(error) }));
  return true;
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "review-link:open-options") {
    chrome.runtime.openOptionsPage();
  }
  return false;
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

async function analyzePullRequest({ owner, repo, number, force = false }) {
  const key = `${owner}/${repo}#${number}`;
  const pr = await github(`/repos/${owner}/${repo}/pulls/${number}`);
  const cacheKey = `${key}@${pr.base.sha}..${pr.head.sha}`;
  if (force) {
    memoryCache.delete(cacheKey);
  }
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  const files = await listFiles(owner, repo, number);
  const author = pr.user?.login;
  const exclude = author ? [author] : [];
  const ranked = files
    .filter((file) => !isIgnoredPath(file.filename))
    .sort((a, b) => b.changes - a.changes);
  const analyzed = new Set(ranked.slice(0, MAX_FILES).map((file) => file.filename));

  const results = await mapLimit(files, CONCURRENCY, async (file) => {
    const base = { path: file.filename, changes: file.changes, shares: [] };
    if (isIgnoredPath(file.filename)) {
      return { ...base, status: "ignored" };
    }
    if (!analyzed.has(file.filename)) {
      return { ...base, status: "skipped" };
    }
    const historyPath = file.status === "renamed" && file.previous_filename ? file.previous_filename : file.filename;
    const commits = await history(owner, repo, pr.base.sha, historyPath);
    const shares = fileShares(commits, { exclude });
    return { ...base, shares, status: shares.length ? "ok" : "no-history" };
  });

  const data = {
    author,
    baseSha: pr.base.sha,
    top: prShares(results),
    files: results,
  };
  memoryCache.set(cacheKey, data);
  return data;
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

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
