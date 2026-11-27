import assert from "node:assert/strict";
import test from "node:test";

import { describeFailure } from "../src/github-errors.js";

const headers = (values = {}) => ({ get: (name) => values[name.toLowerCase()] ?? null });
const json = (message) => JSON.stringify({ message, documentation_url: "https://docs.github.com" });

test("hourly limit wins over other 403 reasons", () => {
  const result = describeFailure({
    status: 403,
    headers: headers({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1800000000" }),
    body: json("API rate limit exceeded"),
    hasToken: true,
  });
  assert.deepEqual(result, { code: "error.rateLimit", params: { resetAt: 1_800_000_000_000 } });
  assert.equal(
    describeFailure({ status: 429, headers: headers({ "x-ratelimit-remaining": "0" }), body: "", hasToken: false }).code,
    "error.rateLimitNoToken"
  );
});

test("secondary rate limit is detected from retry-after or the message", () => {
  assert.deepEqual(describeFailure({ status: 403, headers: headers({ "retry-after": "30" }), body: "", hasToken: true }), {
    code: "error.secondaryRateLimit",
    params: { seconds: 30 },
  });
  const fromMessage = describeFailure({
    status: 403,
    headers: headers({ "x-ratelimit-remaining": "4000" }),
    body: json("You have exceeded a secondary rate limit."),
    hasToken: true,
  });
  assert.deepEqual(fromMessage, { code: "error.secondaryRateLimit", params: { seconds: 60 } });
});

test("403 with a credential keeps GitHub's reason", () => {
  const result = describeFailure({
    status: 403,
    headers: headers({ "x-ratelimit-remaining": "4999" }),
    body: json("Resource not accessible by personal access token"),
    hasToken: true,
  });
  assert.equal(result.code, "error.forbiddenToken");
  assert.equal(result.params.detail, "Resource not accessible by personal access token");
});

test("SSO enforcement is reported separately", () => {
  const result = describeFailure({
    status: 403,
    headers: headers({ "x-github-sso": "required; url=https://github.com/orgs/acme/sso?authorization_request=1" }),
    body: json("Resource protected by organization SAML enforcement."),
    hasToken: true,
  });
  assert.equal(result.code, "error.sso");
});

test("401, 404 and other statuses", () => {
  assert.equal(describeFailure({ status: 401, headers: headers(), body: "", hasToken: true }).code, "error.badToken");
  assert.equal(describeFailure({ status: 404, headers: headers(), body: "", hasToken: true }).code, "error.notFoundToken");
  assert.equal(describeFailure({ status: 404, headers: headers(), body: "", hasToken: false }).code, "error.notFound");
  assert.equal(describeFailure({ status: 403, headers: headers(), body: "", hasToken: false }).code, "error.forbidden");
  assert.deepEqual(describeFailure({ status: 502, headers: headers(), body: "<html>Bad gateway</html>", hasToken: false }), {
    code: "error.http",
    params: { status: 502, detail: "<html>Bad gateway</html>" },
  });
});

test("long or multi-line messages are trimmed", () => {
  const { params } = describeFailure({ status: 500, headers: headers(), body: json(`a\n${"b".repeat(400)}`), hasToken: false });
  assert.equal(params.detail.length, 201);
  assert.ok(params.detail.startsWith("a b"));
});
