# 产品详情说明（发布用）

## 中文

```
在 GitHub PR 页面上显示谁最熟悉改动的代码。

· 相关度 Top 5：按修改历史列出与本次改动最相关的 5 个人，点名字高亮他相关的文件。
· 文件相关度：每个改动文件旁显示最相关的人和占比。
· 文件锚点：点文件名直接跳转。

支持黑白主题和中英文。不收集数据，只访问 api.github.com。
```

## English

```
Shows who knows the code a GitHub pull request changes.

· Top 5 by change relevance: the five people most related to the change, based on commit history. Click a name to highlight their files.
· Per-file relevance: each changed file shows its most related people and their shares.
· File anchors: click a file to jump to it.

Black or white theme, English or Chinese. Collects no data; only talks to api.github.com.
```

---

# 隐私权规范：单一用途说明

## 中文

```
在 GitHub PR 页面上，根据每个改动文件的提交历史，显示与改动代码最相关的人，并让 reviewer 在文件之间跳转。
```

## English

```
On GitHub pull request pages, show which people are most related to the changed code, based on the commit history of each changed file, and let the reviewer jump between files.
```

---

# 隐私权规范：权限理由

审核员看英文，建议填英文版。

## storage

### 中文

```
保存用户的设置（黑白主题、中英文、面板是否收起），以及用户在设置页填写的可选 GitHub token。另外在会话存储里缓存每个文件的提交历史，再次打开同一个 PR 时不必重复请求 GitHub API。除 token 只发给 api.github.com 外，存储的内容不会发往任何地方。
```

### English

```
Saves the user's settings (black or white theme, English or Chinese, whether the panel is collapsed) and the optional GitHub token the user enters on the settings page. Also caches each file's 隐私commit history in session storage, so reopening a pull request does not repeat GitHub API requests. Nothing in storage is sent anywhere, except the token, which goes only to api.github.com.
```

## 主机权限 / Host permissions

后台只有一个“主机权限”输入框时，用下面这段，它同时说明了 github.com 和 api.github.com 两项。

### 中文

```
https://github.com/*：在 GitHub PR 页面上插入面板和每个文件的相关度标签。匹配整个 github.com 而不只是 /pull/ 路径，是因为 GitHub 切换页面时不整页刷新，用户从仓库页点进 PR 时，只注册在 /pull/ 上的脚本不会运行。在非 PR 页面上，脚本只检查网址，不做其他事，也不读取或发送页面内容。

https://api.github.com/*：通过 GitHub REST API 读取 PR 的文件列表和每个文件的提交历史，用来计算相关度。只发 GET 请求，不访问其他任何主机。
```

### English

```
https://github.com/*: adds the panel and the per-file relevance badges to pull request pages. It matches all of github.com, not only /pull/ URLs, because GitHub switches pages without a full reload: when a user goes from a repository page to a pull request, a script registered only for /pull/ URLs would not run. On pages that are not pull requests, the script only checks the URL and does nothing else. It does not read or send page content.

https://api.github.com/*: reads the pull request's file list and each file's commit history from the GitHub REST API to compute relevance. Only GET requests are made, and no other host is contacted.
```
