import assert from "node:assert/strict";
import test from "node:test";

import { fileShares, isIgnoredPath, prShares } from "../src/relevance.js";

const now = Date.parse("2026-01-01T00:00:00Z");
const commit = (login, daysAgo, type = "User") => ({
  author: login ? { login, type } : null,
  commit: { committer: { date: new Date(now - daysAgo * 86_400_000).toISOString() } },
});

test("recent commits weigh more than old ones", () => {
  const shares = fileShares([commit("alice", 0), commit("bob", 180)], { now });
  assert.deepEqual(
    shares.map(({ login, share }) => [login, Number(share.toFixed(3))]),
    [
      ["alice", 0.667],
      ["bob", 0.333],
    ]
  );
});

test("bots, unknown authors and excluded logins are skipped", () => {
  const shares = fileShares(
    [commit("dependabot[bot]", 0), commit("ci", 0, "Bot"), commit(null, 0), commit("Author", 0), commit("bob", 0)],
    { now, exclude: ["author"] }
  );
  assert.deepEqual(shares, [{ login: "bob", share: 1 }]);
});

test("no usable history gives no shares", () => {
  assert.deepEqual(fileShares([commit("author", 0)], { now, exclude: ["author"] }), []);
});

test("PR shares weight files by changed lines and keep the remainder for others", () => {
  const top = prShares(
    [
      { path: "a.rs", changes: 100, shares: [{ login: "alice", share: 0.6 }, { login: "bob", share: 0.4 }] },
      { path: "b.rs", changes: 20, shares: [{ login: "alice", share: 0.2 }, { login: "carol", share: 0.8 }] },
      { path: "new.rs", changes: 500, shares: [] },
    ],
    2
  );
  assert.deepEqual(
    top.map(({ login, share }) => [login, Number(share.toFixed(3))]),
    [
      ["alice", 0.533],
      ["bob", 0.333],
    ]
  );
});

test("lock and generated files are ignored", () => {
  for (const path of ["Cargo.lock", "web/package-lock.json", "pnpm-lock.yaml", "go.sum", "a/b.min.js", "vendor/x.go"]) {
    assert.equal(isIgnoredPath(path), true, path);
  }
  assert.equal(isIgnoredPath("src/lock.rs"), false);
});
