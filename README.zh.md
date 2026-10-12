<div align="center">

🇨🇳 **中文** | [🌐 English](./README.md)

</div>

# dsh-prompt-library（@panando fork）

> **这是 [`@sunjuntao/dsh-prompt-library`](https://www.npmjs.com/package/@sunjuntao/dsh-prompt-library) 的 fork**（原版作者 master1Sun，MIT）。
>
> 本 fork 的改动：
> 1. **词库入口从「注入到宿主侧边栏设置按钮上方」改为「设置 → 词库设置」页底部的入口卡片**，点击弹出独立面板；
>    那个注入按钮原本会同时出现在设置导航顶部与左下角菜单里，现已彻底移除。
> 2. 顺带修好了**浮层内 SVG 图标不显示**（被 `scrollbar-gutter` 压成 0 宽）的问题。
>
> 改动细节、源码来源与构建方式见 [FORK.md](./FORK.md)。原版体验请安装上游包。

DSH（DeepSeek Harness）词库插件：在聊天栏提供**提示词管理**、**AI 优化**与**人格定制**能力，帮你沉淀、复用和持续优化提示词。

## 主要功能

### 词库

- 管理常用提示词（标题 + 正文 + 标签），支持搜索、排序、标签分组、使用次数统计
- 入口一：**设置 → 词库设置**页底部的「词库」入口卡片，点击弹出独立面板（850×800，可最大化，✕ / Esc 关闭），面板内以 Tab 切换数据管理、导入导出、标签、回收站
- 入口二：聊天输入框旁的词库按钮，一键打开最近/常用提示词列表
- **插入**：追加到输入框已有内容之后
- **覆盖**：用该提示词直接替换整段草稿
- **插入并发送**：填写模板变量后一键直接发出（含 `{{}}` 时走变量弹窗），非 `#` 场景下仅在草稿为空时可用，避免误带已有内容；`#` 触发时会过滤触发词、保留其前正文一并发送
- 输入 `#` 快速触发选择，实时筛选
- 底部实时显示标签总数与提示词总数

### 生成 Skill

- 在「词库菜单 → 技能管理」的技能导入弹窗中勾选提示词后批量生成 DSH 技能（Skill）
- 由 AI 根据提示词内容生成英文技能名与描述，技能写盘到 `~/.dsh/skills/<name>/SKILL.md`，聊天框输入 `/技能名` 即可触发，模型也会按描述自动匹配
- 生成时自动建立提示词与技能的关联；同一提示词再次生成会**覆盖原技能目录**，不会无限新增
- 若正文含 `{{变量}}`，生成时会标注「占位符自动补全」能力——使用该技能时 AI 依据当前语义场景自动推断并补全，无需手动填值

### AI 优化

- 聊天栏「AI 优化」按钮一键优化文字，完成后一键替换回输入框
- 优化过程遵循人格设定的约束

### 人格（AI 只读引用）

人格正文存于数据库（`prompts.db`：默认人格在 meta 表、自定义人格在 personas 表），约束每一次 AI 调用与所在会话，形成稳定的助手人格。缺失时自动写入默认模板；内容由**用户手动维护**，AI 只读引用、不擅自改写。支持创建多份人格（SOUL），按「工作区 / 项目」绑定，命中路径下新开的会话自动采用对应人格。


| 存储 | 含义 | 作用                      |
| ---- | ---- | ------------------------- |
| SOUL | 人格 | 身份、性格/语气、工作规范 |

- 输入框为空时按最近聊天上下文推荐提示词，点击即插入草稿
- 人格为用户的显式设定（含默认模板），AI 据此遵循性格、语气与工作规范

### 设置

在 DSH 设置 → 词库设置直达：AI 模型选择、面板大小、聊天框按钮显隐/仅图标、`#` 触发、上下文推荐、选中添加提示词、提示词最大存储数量等，修改即时生效。

## 数据存储

词库采用 **SQLite**（`node:sqlite`），其余配置与日志统一存放在 `~/.dsh/prompt-library/`：

```
~/.dsh/prompt-library/
├── db/prompts.db      # 词库 + 人格 + 技能绑定（SQLite）/ prompt library, personas & bindings (SQLite)
├── settings.json      # 插件设置（prompt-library 命名空间）
├── log/
│   └── ai-YYYY-MM-DD.log   # AI 调用诊断日志（按日期分文件）
└── character/         # （旧版遗留，仅迁移读取；人格现存于数据库）
```

## 安装

```bash
dsh plugin --profile web add @panando/dsh-prompt-library
```

## 使用

启动 `dsh web`，进入 **设置 → 词库设置**，点击页面底部的「词库」入口卡片打开功能面板；或在聊天栏点「词库」按钮、输入 `#` 快速触发选择；点击「AI 优化」一键优化输入内容。

## 开发 / 构建

```bash
npm install
npm run build   # 构建 lib/client.js 与 lib/index.js
npm run check   # node --check 两份产物
npm test        # jsdom 里跑 apply() + 真渲染设置页（23 条断言）

# 联调：软链进 desktop profile，改完刷新/重启 DSH 即生效
../scripts/link-plugin.sh dsh-prompt-library
# 调完还原：../scripts/link-plugin.sh dsh-prompt-library --unlink
```

## 作者

原版作者 **master1Sun**（MIT）：[github.com/master1Sun/dsh-prompt-library](https://github.com/master1Sun/dsh-prompt-library)

本 fork 由 **panando** 维护：仅调整入口位置与浮层图标渲染，提示词管理 / AI 优化 / 人格 等功能逻辑沿用上游。
