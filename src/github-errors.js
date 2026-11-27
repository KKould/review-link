// Turns a failed GitHub API response into a message key plus parameters.
// Pure function so it can be tested without chrome.* or the network.

const DETAIL_LIMIT = 200;

// headers: anything with get(name); body: response text (may be empty or non-JSON).
export function describeFailure({ status, headers, body, hasToken }) {
  const detail = githubMessage(body);

  if ((status === 403 || status === 429) && headers.get("x-ratelimit-remaining") === "0") {
    const reset = Number(headers.get("x-ratelimit-reset")) * 1000;
    return {
      code: hasToken ? "error.rateLimit" : "error.rateLimitNoToken",
      params: { resetAt: Number.isFinite(reset) && reset > 0 ? reset : null },
    };
  }
  // Secondary limits: too many requests in a short time, independent of the hourly quota.
  if ((status === 403 || status === 429) && (headers.get("retry-after") || /secondary rate limit/i.test(detail))) {
    const seconds = Number(headers.get("retry-after"));
    return { code: "error.secondaryRateLimit", params: { seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 60 } };
  }
  if (status === 401) {
    return { code: "error.badToken", params: {} };
  }
  if (status === 403 && headers.get("x-github-sso")) {
    return { code: "error.sso", params: { detail } };
  }
  if (status === 403) {
    return { code: hasToken ? "error.forbiddenToken" : "error.forbidden", params: { detail } };
  }
  if (status === 404) {
    return { code: hasToken ? "error.notFoundToken" : "error.notFound", params: {} };
  }
  return { code: "error.http", params: { status, detail } };
}

function githubMessage(body) {
  if (!body) {
    return "";
  }
  let message = body;
  try {
    message = JSON.parse(body).message || body;
  } catch {
    // Not JSON; keep the raw text.
  }
  message = String(message).replace(/\s+/g, " ").trim();
  return message.length > DETAIL_LIMIT ? `${message.slice(0, DETAIL_LIMIT)}…` : message;
}
