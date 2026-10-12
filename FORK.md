# dsh-prompt-library（@panando fork）

- 本 fork 包名：**`@panando/dsh-prompt-library`**（当前 0.18.0）
- 上游：<https://github.com/master1Sun/dsh-prompt-library> · npm `@sunjuntao/dsh-prompt-library@0.17.1`

> **包名为什么不是上游那个**：发布账号 `panando-npm` 不属于 `@sunjuntao` 组织，往那个 scope 发会 403；
> 本仓库既有的自研/派生插件统一发在 `@panando/` 下（dsh-pua、dsh-quote-sidechat、dsh-prompt-optimizer）。
> 因此本 fork 改名为 `@panando/dsh-prompt-library`，版本从 0.17.1 起做了一次 minor bump（入口位置是行为可见的改动）。
> 客户端模块 id（`window.__ModuleLoader__.load({id})`）与 `cordis.patch.yml` 的 `name` 都跟着改成新包名；
> 其中构建脚本的 id 现在**直接读 package.json#name**，以后改名不会再漏。

## 为什么有这个 fork

上游的「词库」入口是一个**注入式按钮**：`SettingsAboveMenuButton` 用 `MutationObserver`
扫描 `document.body`，只要发现文本正好是「设置」的元素，就把自己插到它前面。结果是同一个按钮
同时长在**设置面板左侧导航顶部**和**侧边栏左下角菜单**里，两处都突兀，而且只能用
`settingsAboveMenuEnabled` 整体隐藏、不能只留一处。

本 fork 的改动：

1. **入口移入设置页**：在「设置 → 词库设置」页底部新增一条与
   「AI 模型 / 面板显示 / 显示与交互 / 关于」同款式的入口卡片「词库」（右侧用指向右的箭头，
   与折叠卡片的向下箭头区分）。**点击后弹出独立面板**（850×800 居中浮层，可最大化，
   ✕ / Esc 关闭，走 `PL_DIALOG_CSS` 里官方浮层表面），面板内以四个 Tab 承载
   数据管理 / 导入导出 / 标签 / 回收站。见
   `src/client/components/settings/LibraryPanelSection.tsx`。

   > 为什么是独立面板而不是内嵌折叠项：这套 UI 按 ~800px 宽度设计，内嵌进设置页那条
   > 520px 的内容列后，列表与详情两栏会被同时压扁（实测观感就是「太小了」）。

   > 面板右上角的最大化/还原按钮用**内联 SVG**（`MaximizeButton`，与上游浮动面板手写的图标
   > 逐字一致），没有用共享组件 `WindowToggleButton` —— 后者渲染文本字形 🗖 / 🗗
   > （U+1F5D6 / U+1F5D7），在缺字体的宿主环境会被回退成一个「≡」似的怪符号。
2. **左下角菜单里的注入按钮彻底移除**：删除 `SettingsAboveMenuButton`（DOM 注入 + 浮动面板
   + 遮罩/最大化/关闭）与随之失效的 `settingsAboveMenuEnabled` 开关（字段保留，仅为兼容
   既有 `settings.json`）。
3. **去掉中转环节**：不再走 `pl:show-panel-content` / `pl:hide-panel-content` 窗口事件 +
   `PromptAssistant` 中转，四项功能由设置页内的折叠项直接渲染，因此不依赖会话页是否挂载。

### 顺带的体积变化（不是功能回退）

`lib/client.js` 由 794.6kb 降到 632.4kb。原因是上游 `PromptAssistant` 的 `switch` 里有
`persona`（人格管理）与 `workspaceInstructions`（技能管理）两个分支，但**全插件没有任何地方
派发这两个 key**（唯一派发方就是被移除的那个浮动面板，且只派发四项）——即它俩本来就是不可达的
死代码。删除 `PromptAssistant` 后它们连同 `PersonaManagerModal` / `PromptInjectPanel` /
`HarnessSkillPanel` / `ImportConfirmModal` 一起被 tree-shake 掉。

如需把「人格管理 / 技能管理」真正用起来，只需在 `LibraryPanelSection.tsx` 的 `NAV_ITEMS`
里补两项、并在 `renderModule()` 里接上即可（这两个组件已支持 `container` 内嵌模式）。

## 源码来源（重要）

GitHub 在本机不可达（443 连不通），因此 `src/` 是**从上游 npm 包自带的 sourcemap 还原**的
（`lib/client.js.map` + `lib/index.js.map` 的 `sourcesContent`，共 58 个文件）。
上游仓库里未被打包进 bundle 的文件不在其中，本 fork 自行补齐：

| 文件 | 说明 |
| --- | --- |
| `scripts/build.mjs` | 复刻上游 esbuild 配置：客户端 CJS + `window.__ModuleLoader__` 外壳、`define`（`__DEV__` / `__PLUGIN_VERSION__`）、externals |
| `scripts/smoke-test.mjs` | jsdom 里跑 `apply()`，断言注册出的 UI 座位 |
| `src/host/refine.ts` | 上游被完全 tree-shake 的文件（唯一调用方 `enrichLearnedPrompt` 未被注册），按调用方契约与同族解析器重建 |
| `tsconfig.json`、`src/globals.d.ts`、`.gitignore` | 类型检查与工程脚手架 |

**基线已逐字节验证**：从还原出的源码构建，`lib/client.js` 与 `lib/index.js` 与 npm 上的
`@sunjuntao/dsh-prompt-library@0.17.1` **逐字节一致**（`git log` 的第一个提交即该基线）。
因此日后若 GitHub 可达，请以本 fork 第一个提交为基准与上游 diff，再叠加本 fork 的第二个提交。

> 依赖版本已按上游产物锁定：`js-yaml` 固定 `5.3.0`（`^5.3.0` 会解析到 5.4.3，产物会因此不同），
> `esbuild` 用 `^0.23.0`（上游同款）。

## 构建与自检

```bash
npm install
npm run build      # → lib/client.js、lib/index.js
npm run check      # node --check 两个产物
npm test           # smoke-test:  jsdom 里跑 apply()，断言注册出的座位
                   # render-test: jsdom 里真渲染「词库设置」页，跑完
                   #              入口卡片 → 点击弹独立面板 → 四个 Tab → 最大化/还原 → ✕/Esc 关闭
                   #              共 19 条断言（含「数据管理模块确实内嵌进面板」）
npm run typecheck  # 需要 @deepseek-ai/* 的类型包，未装时会有 TS2307 噪声
```

## 发布到 npm

```bash
npm run build          # 先构建（prepublishOnly 里也会跑 build + test）
npm pack --dry-run     # 看 tarball 内容
npm publish --access public
```

发布后本地 profile 要从旧包名切到新包名（否则 DSH 会按旧名去加载、而包内的 patch 已声明新名）：

```bash
./scripts/link-plugin.sh dsh-prompt-library desktop --unlink   # 旧名软链（若已 rename 需手工删）
rm ~/.dsh/profiles/desktop/node_modules/@sunjuntao/dsh-prompt-library   # 视情况：旧名软链/目录
./scripts/link-plugin.sh dsh-prompt-library desktop            # 按新名建软链
# 并把 ~/.dsh/profiles/desktop/package.json 的 bundles 里旧名 @sunjuntao/dsh-prompt-library 删掉
```

## 联调进 profile

```bash
./scripts/link-plugin.sh dsh-prompt-library desktop     # 软链 + 确保在 bundles 里
# 重启 DSH（或刷新页面）后生效
./scripts/link-plugin.sh dsh-prompt-library desktop --unlink   # 还原成 npm 装的那份
```

软链会把 profile 里 npm 装的那份**备份并替换**（`…bak.<时间戳>`），上游发新版不会被静默带走。
