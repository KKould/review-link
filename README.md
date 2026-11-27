# Review Link

A Chrome extension for GitHub pull request reviews. Its layout and file anchors follow the WebEcho extension.

- **Top 5 by change relevance:** a floating panel on each PR lists the 5 people most related to the change. Click a person to highlight their files, dim the rest, and jump to the first one.
- **Per-file relevance:** each file header in "Files changed" shows the top 3 people for that file, plus the share left to everyone else.
- **File anchors:** the panel lists every file. Click one to jump to it; the item for the file you are reading stays highlighted as you scroll.
- **Settings:** black or white theme, Chinese or English, and an optional GitHub token. Changes apply to open GitHub tabs right away.

## How relevance is computed

For each changed file, the extension reads up to 50 commits that touched it before the PR's base commit. Each commit counts toward its author with a weight that halves every 180 days. The PR author and bots are excluded. The weights are normalized into shares for that file.

The PR-level Top 5 sums those shares across files, weighting each file by its changed lines. Lock files and generated files are skipped. New files have no history and say so. At most 100 files are analyzed per PR, largest changes first.

The numbers come from history, so they show who knows the code. They do not say who must review it.

## Install (development)

1. Open `chrome://extensions` and turn on Developer mode.
2. Click "Load unpacked" and pick this directory.
3. Open any GitHub pull request.

Without a token the GitHub API allows about 60 requests per hour, and private repositories do not work. One PR costs about 2 requests plus 1 per file. Add a fine-grained token with read-only Contents and Pull requests access in the extension's settings.

## Test

```bash
npm test
```

## Release

```bash
npm run pack    # runs the tests, checks the manifest, writes dist/review-link-<version>.zip
npm run crx     # pack, then sign dist/review-link-<version>.crx with your private key
npm run icons   # re-renders icons/*.png from scripts/icon.svg.js; needs Chrome (pass a path or set CHROME)
```

`pack` refuses to build if an icon has the wrong size, a `__MSG_*__` key is missing from a locale, a store description is over 132 characters, or the manifest points to a missing file. The zip only contains `manifest.json`, `_locales/`, `icons/*.png` and `src/`. Bump `version` in `manifest.json` before each upload.

### Signed CRX (Verified CRX uploads)

The developer account uses Verified CRX uploads, so the dashboard only accepts a `.crx` signed with the registered key.

- The private key lives outside the repo at `~/.config/review-link/review-link-signing.pem` (mode 600). Set `REVIEW_LINK_KEY` to use another path. `*.pem` and `*.crx` are git-ignored.
- Its public key is [`docs/signing-public-key.pem`](docs/signing-public-key.pem). Paste it into Package > Verified CRX uploads.
- Back the private key up offline. If it is lost, replacing it goes through Chrome Web Store support and can take up to a week.
- On another machine, restore the backed-up key to that path. Do not create a new one: a new key does not match the registered public key and the dashboard will reject the upload. `node scripts/crx.mjs --init-key` is only for the very first setup, and it refuses to overwrite an existing key.
- `crx` signs `dist/review-link-<version>/`, the same files as the zip. If Chrome is not `google-chrome` on PATH, set `CHROME=/path/to/chrome`.

Store submission drafts:

- [`docs/store-listing.md`](docs/store-listing.md): name, descriptions, screenshot plan and reviewer test steps, in English and Chinese.
- [`docs/privacy-practices.md`](docs/privacy-practices.md): single purpose, permission justifications, remote code and data usage answers.
- [`docs/privacy-policy.md`](docs/privacy-policy.md): the privacy policy. It needs a contact email and a public URL before submission.
