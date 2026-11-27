# Privacy Policy / 隐私政策

Last updated / 最后更新：2026-11-27

> Draft. Host this page at a public URL before publishing, then remove this note.
> 草稿。发布前把本页放到一个公开可访问的网址上，然后删掉这段说明。

---

## English

Review Link is a browser extension that shows, on GitHub pull request pages, which people are most related to the changed code based on its commit history.

**What the extension does not do**

- It has no server of its own. Nothing is sent to the developer.
- It does not collect analytics, track usage, or show ads.
- It does not sell or share any data with anyone.

**Data the extension handles**

| Data | Why | Where it goes | Where it is stored |
| --- | --- | --- | --- |
| The owner, repository and number of the pull request you open on github.com | To know which pull request to analyze | GitHub's API (`api.github.com`) | Not stored |
| Pull request file lists and commit history returned by GitHub's API, including the GitHub usernames of commit authors | To compute relevance | Nowhere; used only inside your browser | Kept in memory and in the browser's session storage, cleared when the browser closes |
| Your GitHub personal access token, only if you enter one | To read private repositories and get a higher API limit | Sent only to `api.github.com` in the `Authorization` header | This browser's local extension storage (`chrome.storage.local`). It is not synced to other devices |
| Theme, language and whether the panel is collapsed | To remember your settings | Nowhere | Chrome's extension storage; theme and language sync through your Chrome account if Chrome Sync is on |

GitHub's handling of API requests is covered by [GitHub's privacy statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

**Your control**

- Remove the token at any time with "Clear" on the settings page.
- Uninstalling the extension deletes all of its stored data.
- Use a fine-grained token with read-only access to the repositories you review.

**Limited use**

The use of information received from GitHub's API follows the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/policies), including the Limited Use requirements. Data is used only to show relevance on the page you are viewing.

**Changes and contact**

Changes to this policy will be posted on this page with a new date. Questions: `kould2333@gmail.com`.

---

## 中文

Review Link 是一个浏览器扩展。它在 GitHub PR 页面上，根据代码的提交历史，显示哪些人与这次改动的代码最相关。

**扩展不会做的事**

- 没有自己的服务器，不会向开发者发送任何数据。
- 不做统计分析，不追踪使用行为，不展示广告。
- 不出售、不与任何人共享数据。

**扩展会处理的数据**

| 数据 | 用途 | 发往哪里 | 存在哪里 |
| --- | --- | --- | --- |
| 你在 github.com 打开的 PR 所属的用户、仓库和编号 | 确定要分析哪个 PR | GitHub API（`api.github.com`） | 不存储 |
| GitHub API 返回的 PR 文件列表和提交历史，包括提交作者的 GitHub 用户名 | 计算相关度 | 不发往任何地方，只在你的浏览器里使用 | 保存在内存和浏览器会话存储中，关闭浏览器即清除 |
| 你的 GitHub 个人访问令牌（仅在你填写时） | 读取私有仓库、提高 API 额度 | 只通过 `Authorization` 请求头发给 `api.github.com` | 本机浏览器的扩展本地存储（`chrome.storage.local`），不会同步到其他设备 |
| 主题、语言、面板是否收起 | 记住你的设置 | 不发往任何地方 | Chrome 扩展存储；如果开启了 Chrome 同步，主题和语言会随 Chrome 账号同步 |

GitHub 如何处理 API 请求，见 [GitHub 隐私声明](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement)。

**你可以控制的**

- 随时在设置页点「清除」删除令牌。
- 卸载扩展会删除它存储的全部数据。
- 建议使用 fine-grained token，只给需要 review 的仓库只读权限。

**有限使用**

对 GitHub API 返回信息的使用遵守 [Chrome 应用商店用户数据政策](https://developer.chrome.com/docs/webstore/program-policies/policies)，包括其中的「有限使用」要求。这些数据只用于在你正在看的页面上显示相关度。

**变更与联系**

本政策如有变更，会在此页面更新并修改日期。如有问题请联系：`kould2333@gmail.com`。
