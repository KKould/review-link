# Privacy practices tab / 隐私权规范页面

Answers for the "Privacy practices" tab in the Developer Dashboard. Reviewers read these in English; the Chinese is for checking.

开发者后台「隐私权规范」标签页的填写内容。审核员看英文，中文用于核对。

---

## Single purpose 单一用途

```
On GitHub pull request pages, show which people are most related to the changed code, based on the commit history of each changed file, and let the reviewer jump between files.
```

在 GitHub PR 页面上，根据每个改动文件的提交历史，显示与改动代码最相关的人，并让 reviewer 在文件之间跳转。

---

## Permission justifications 权限说明

The dashboard lists one field per permission in `manifest.json`. 后台会按 `manifest.json` 里的权限逐项列出。

### `storage`

```
Saves the user's settings (black or white theme, English or Chinese, whether the panel is collapsed) and the optional GitHub token the user enters on the settings page. Also caches commit history per file in session storage, so revisiting a pull request does not repeat GitHub API requests. Nothing in storage is sent anywhere except the token, which goes only to api.github.com.
```

保存用户设置（黑白主题、中英文、面板是否收起）和用户在设置页填写的可选 GitHub token；并在会话存储里按文件缓存提交历史，再次打开同一个 PR 时不必重复请求 GitHub API。除 token 只发给 api.github.com 外，存储内容不会发往任何地方。

### Host permission `https://api.github.com/*`

```
The extension reads the pull request's file list and each file's commit history from the GitHub REST API (GET /repos/{owner}/{repo}/pulls/{number}, /pulls/{number}/files, and /commits?path=...). These requests come from the service worker. No other host is contacted.
```

扩展通过 GitHub REST API 读取 PR 的文件列表和每个文件的提交历史（GET /repos/{owner}/{repo}/pulls/{number}、/pulls/{number}/files、/commits?path=...）。请求由 service worker 发出，不访问其他任何主机。

### Content script on `https://github.com/*`

```
The content script adds the panel and the per-file badges to pull request pages. It matches all of github.com, not only /pull/ URLs, because GitHub switches pages without a full reload: when a user goes from a repository page to a pull request, a script registered only for /pull/ URLs would not run. On every page that is not a pull request, the script only checks the URL and does nothing else. It does not read or send page content.
```

内容脚本在 PR 页面上加入面板和每个文件的相关度标签。它匹配整个 github.com，而不只是 /pull/ 路径，因为 GitHub 切换页面时不整页刷新：用户从仓库页点进 PR 时，只注册在 /pull/ 路径上的脚本不会运行。在非 PR 页面上，脚本只检查网址，不做其他事，也不读取或发送页面内容。

---

## Remote code 远程代码

Select **"No, I am not using remote code"**. 选择「否，我未使用远程代码」。

All JavaScript ships in the package. The extension only fetches JSON data from api.github.com and never evaluates it as code.

所有 JavaScript 都在安装包内。扩展只从 api.github.com 获取 JSON 数据，从不把它当代码执行。

---

## Data usage 数据使用

**Data types collected — check these 勾选的数据类型：**

- [x] **Authentication information 身份验证信息**: the optional GitHub personal access token. 可选的 GitHub 个人访问令牌。

**Leave unchecked 不勾选：** personally identifiable information, health, financial and payment, personal communications, location, web history, user activity, website content.

Why not the others 为什么不勾选其他项：

- GitHub usernames of commit authors come from GitHub's public API about the repository. They are not data about the user of the extension and are not stored beyond the browser session. 提交作者的用户名来自 GitHub 关于仓库的 API，不是扩展使用者本人的数据，存放时间不超过浏览器会话。
- The extension reads the current URL only to detect a pull request, and sends the owner, repository and number to GitHub, the same service the user is already on. It keeps no browsing history. 扩展读取当前网址只为判断是不是 PR，并把用户、仓库和编号发给 GitHub，也就是用户正在使用的同一个服务。它不记录浏览历史。

This is a judgment call. If a reviewer asks for "Website content" or "Web history" to be declared, checking them does not require any code change. 这是一个判断。如果审核要求申报「网站内容」或「网络历史记录」，勾上即可，不需要改代码。

**Certifications — check all three 三项声明全部勾选：**

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases. 不向第三方出售或转让用户数据（获准的用途除外）。
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose. 不将用户数据用于与单一用途无关的目的。
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes. 不将用户数据用于判断信用或借贷。

---

## Privacy policy URL 隐私政策网址

Required because the extension handles authentication information. Host `docs/privacy-policy.md` at a URL anyone can open without signing in.

因为扩展会处理身份验证信息，这一项必填。需要把 `docs/privacy-policy.md` 放到一个不用登录就能打开的网址上。
