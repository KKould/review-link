// Pure scoring logic. No chrome.* or network access, so it can be tested with `node --test`.

export const HALF_LIFE_DAYS = 180;
export const TOP_N = 5;

const IGNORED_PATTERNS = [
  /(^|\/)(Cargo|package-lock|yarn|pnpm-lock|poetry|Gemfile|composer|Pipfile|flake|bun)\.(lock|json|yaml)$/,
  /(^|\/)(go\.sum|uv\.lock|bun\.lockb)$/,
  /\.min\.(js|css)$/,
  /(^|\/)(vendor|node_modules|dist)\//,
];

export function isIgnoredPath(path) {
  return IGNORED_PATTERNS.some((pattern) => pattern.test(path));
}

export function isBot(login, type) {
  return type === "Bot" || /\[bot\]$/i.test(login || "");
}

// commits: GitHub "list commits" items for one path, taken before the PR base.
// Returns [{ login, share }] sorted by share, shares summing to 1, or [] if no usable history.
export function fileShares(commits, { now = Date.now(), exclude = [] } = {}) {
  const excluded = new Set(exclude.map((login) => login.toLowerCase()));
  const scores = new Map();
  for (const item of commits) {
    const login = item.author?.login;
    if (!login || isBot(login, item.author?.type) || excluded.has(login.toLowerCase())) {
      continue;
    }
    const date = Date.parse(item.commit?.committer?.date || item.commit?.author?.date || "");
    const ageDays = Number.isFinite(date) ? Math.max(0, (now - date) / 86_400_000) : 0;
    const weight = 0.5 ** (ageDays / HALF_LIFE_DAYS);
    scores.set(login, (scores.get(login) || 0) + weight);
  }
  return normalize(scores);
}

// files: [{ path, changes, shares }]. Each file counts in proportion to its changed lines.
export function prShares(files, limit = TOP_N) {
  const scores = new Map();
  for (const file of files) {
    if (!file.shares?.length) {
      continue;
    }
    const weight = Math.max(1, file.changes || 0);
    for (const { login, share } of file.shares) {
      scores.set(login, (scores.get(login) || 0) + weight * share);
    }
  }
  return normalize(scores).slice(0, limit);
}

function normalize(scores) {
  const total = [...scores.values()].reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return [];
  }
  return [...scores.entries()]
    .map(([login, score]) => ({ login, share: score / total }))
    .sort((a, b) => b.share - a.share || a.login.localeCompare(b.login));
}
