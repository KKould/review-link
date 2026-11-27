# Chrome Web Store listing / 商店文案

Paste these into the Developer Dashboard. The short description comes from `_locales/*/messages.json` and shows up automatically; keep the two in sync.

在开发者后台的「商品详情」里按语言分别粘贴。简短说明来自 `_locales/*/messages.json`，商店会自动读取，改的时候两边一起改。

| Field 字段 | Value 值 |
| --- | --- |
| Name 名称 | Review Link |
| Category 类别 | Developer Tools（开发者工具） |
| Default language 默认语言 | English；另加 中文（简体） |
| Homepage 主页 | 仓库公开前先留空 |
| Support 支持 | 仓库公开前先留空，或填开发者邮箱 |

---

## English

**Short description** (115/132 characters)

> See who knows the code a GitHub pull request changes: a Top 5 by change history, per-file shares, and file anchors.

**Detailed description**

```
Review Link adds a small panel to GitHub pull requests that answers one question: who knows the code this PR changes?

Top 5 by change relevance
The panel lists the five people whose past commits are most related to the files in this PR. Click a name to highlight their files, dim the rest, and jump to the first one.

Relevance on every file
In "Files changed", each file header shows the top three people for that file and the share left to everyone else, so a reviewer can tell at a glance which files to read first.

File anchors
The panel lists every changed file. Click one to jump to it. The file you are reading stays highlighted as you scroll.

How the numbers work
For each file, Review Link reads up to 50 commits made before the PR's base commit. Recent commits count more: a commit's weight halves every 180 days. The PR author and bots are left out. Each file's numbers are then added up across the PR, weighted by how many lines changed. Lock files and generated files are skipped, and new files are marked as having no history.
The numbers describe who has worked on the code. They do not decide who has to review it.

Settings
- Black or white theme
- English or Chinese
- Optional GitHub token for private repositories and a higher API limit

Privacy
Review Link has no server and collects nothing. It talks only to api.github.com. If you add a token, it stays in this browser's local storage and is sent only to api.github.com.
```

---

## 中文（简体）

**简短说明**（56/132 字符）

> 看清 GitHub PR 改动的代码谁最熟悉：按修改历史给出相关度 Top 5、每个文件的相关度占比和文件锚点。

**详细说明**

```
Review Link 在 GitHub PR 页面上加一个小面板，回答一个问题：这次改动的代码，谁最熟悉？

变更相关度 Top 5
面板列出与本次 PR 改动文件最相关的 5 个人，依据是他们过去的提交。点一个名字，会高亮他相关的文件、淡化其余文件，并跳到第一个。

每个文件的相关度
在「Files changed」里，每个文件标题旁会显示这个文件相关度最高的 3 个人，以及其余人合计的占比。reviewer 一眼就能看出先读哪些文件。

文件锚点
面板列出所有改动的文件，点一下就跳过去。滚动时，正在看的文件会一直高亮。

数字怎么算
对每个文件，Review Link 读取 PR 基准提交之前最多 50 次提交。越新的提交权重越高，每过 180 天减半。PR 作者和机器人不计入。然后按每个文件改动的行数加权，汇总成整个 PR 的排名。锁文件和生成文件会跳过，新文件会标注为暂无修改历史。
这些数字说明谁改过这些代码，不决定谁必须来 review。

设置
- 黑色或白色主题
- 中文或英文
- 可选的 GitHub token，用于私有仓库和更高的 API 额度

隐私
Review Link 没有服务器，不收集任何数据，只访问 api.github.com。如果你填了 token，它只保存在本机浏览器里，也只发给 api.github.com。
```

---

## Screenshots 截图（至少 1 张，最多 5 张，1280×800）

Take these after checking the signed-in GitHub layout. 等确认登录后的 GitHub 页面效果后再截。

1. PR "Files changed" with the panel open and per-file badges, black theme. 黑色主题，面板展开，文件标题上有相关度标签。
2. The same page, white theme. 同一页面，白色主题。
3. A person selected: their files highlighted, the rest dimmed. 点选一个人后，相关文件高亮、其余淡化。
4. Settings page. 设置页。

Screenshots can be uploaded per language, so make English and Chinese sets. 截图可以按语言分别上传，中英文各一套。

Small promo tile 440×280 is optional, but listings without it are shown after those with one. 440×280 小宣传图不是必须的，但没有它的商品会排在有它的后面。

---

## Test instructions for reviewers 给审核员的测试说明

```
No account, login or token is needed.

1. Open a public pull request's "Files changed" tab, for example:
   https://github.com/databendlabs/databend/pull/21240/files
2. A "Review Link" panel appears at the top right. It lists the Top 5 people by change relevance and every changed file.
3. Each file header shows a badge such as "@alice 60%  @bob 25%  Others 15%".
4. Click a name in the panel: that person's files are highlighted and the page scrolls to the first one.
5. Click "Settings" in the panel to switch between black and white themes and between English and Chinese.

Without a token, GitHub allows about 60 API requests per hour per IP address. A PR costs about 2 requests plus 1 per file.
```
