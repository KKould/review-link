// Signs the packed extension into dist/review-link-<version>.crx for "Verified CRX uploads".
// Run `npm run pack` first; this signs exactly the files that went into the zip.
//
// The private key never lives in the repository. Default location:
//   ~/.config/review-link/review-link-signing.pem   (override with REVIEW_LINK_KEY)
// Create it once with `node scripts/crx.mjs --init-key`, then register the printed
// public key in the Developer Dashboard (Package > Verified CRX uploads).
//
// Usage: node scripts/crx.mjs [--init-key] [path-to-chrome]   (or set CHROME)
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const args = process.argv.slice(2);
const initKey = args.includes("--init-key");
const chrome = args.find((arg) => !arg.startsWith("--")) || process.env.CHROME || "google-chrome";
const keyPath = process.env.REVIEW_LINK_KEY || join(homedir(), ".config", "review-link", "review-link-signing.pem");

if (initKey) {
  if (existsSync(keyPath)) {
    console.error(`Refusing to overwrite existing key: ${keyPath}`);
    process.exit(1);
  }
  mkdirSync(dirname(keyPath), { recursive: true, mode: 0o700 });
  execFileSync("openssl", ["genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048", "-out", keyPath], {
    stdio: "ignore",
  });
  chmodSync(keyPath, 0o600);
  console.log(`Created ${keyPath} (mode 600). Back it up somewhere safe; losing it means a support ticket.`);
  console.log("\nPublic key for Package > Verified CRX uploads:\n");
  console.log(execFileSync("openssl", ["rsa", "-in", keyPath, "-pubout"], { stdio: ["ignore", "pipe", "ignore"] }).toString());
  process.exit(0);
}

if (!existsSync(keyPath)) {
  console.error(`No signing key at ${keyPath}. Create one with: node scripts/crx.mjs --init-key`);
  process.exit(1);
}
if ((statSync(keyPath).mode & 0o077) !== 0) {
  console.error(`${keyPath} is readable by other users. Run: chmod 600 ${keyPath}`);
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const staged = join(root, "dist", `review-link-${version}`);
if (!existsSync(join(staged, "manifest.json"))) {
  console.error(`Missing ${relative(root, staged)}/. Run npm run pack first.`);
  process.exit(1);
}

// Chrome writes <dir>.crx next to the directory. A leftover .pem there would mean
// Chrome generated a new key, which must never happen here.
const produced = `${staged}.crx`;
const strayKey = `${staged}.pem`;
rmSync(produced, { force: true });
execFileSync(chrome, ["--headless=new", "--no-first-run", `--pack-extension=${staged}`, `--pack-extension-key=${keyPath}`], {
  stdio: "ignore",
});
if (existsSync(strayKey)) {
  rmSync(strayKey);
  console.error("Chrome generated its own key instead of using yours; removed it. Check the key file.");
  process.exit(1);
}
if (!existsSync(produced)) {
  console.error("Chrome did not produce a .crx file.");
  process.exit(1);
}
const target = join(root, "dist", `review-link-${version}.crx`);
if (produced !== target) renameSync(produced, target);
console.log(`${relative(root, target)} signed with ${keyPath}`);

