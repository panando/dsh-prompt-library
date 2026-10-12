/**
 * render-test.mjs — 在 jsdom 里把「词库设置」页真的渲染出来，验证新入口。
 *
 * 覆盖三件事（对应本次改动的三条要求）：
 *   1. 设置页能挂载，且底部出现与其它分类同款式的「词库」折叠项；
 *   2. 默认折叠 —— 展开前没有任何 Tab；
 *   3. 点开后出现 数据管理 / 导入导出 / 标签 / 回收站 四个 Tab。
 *   4. 注入式按钮（[data-pl-sa-wrap]）必须不存在。
 *
 * 宿主 UI 只用到 primitives 的 { Button }，用渲染成 null 的桩替代即可。
 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import React from "react";
import { createRoot } from "react-dom/client";
import * as jsxRuntime from "react/jsx-runtime";
import * as ReactDOM from "react-dom";

const DEFAULT_SETTINGS = {
  panelWidth: 360, panelHeight: 500, maxPromptCount: 100,
  aiProvider: "", aiModel: "",
  settingsAboveMenuEnabled: true, showComposerButton: true, composerButtonIconOnly: true,
  showAIPolishButton: true, aiPolishButtonIconOnly: true, tildaTriggerEnabled: true,
  selectionAddEnabled: true, contextRecommendEnabled: true, dataManagementEnabled: true,
};

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
  runScripts: "outside-only",
  url: "http://localhost/",
});
const w = dom.window;
for (const k of [
  "window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "CustomEvent",
  "MouseEvent", "MutationObserver", "requestAnimationFrame", "cancelAnimationFrame",
  "getComputedStyle", "localStorage", "SVGElement", "DocumentFragment", "HTMLInputElement",
]) {
  if (w[k] === undefined) continue;
  try {
    Object.defineProperty(globalThis, k, { value: w[k], writable: true, configurable: true });
  } catch {
    /* Node 里少数全局量是只读的（如 navigator），跳过即可 */
  }
}

// —— 宿主能力桩：fetch 返回插件 API 的信封，WebSocket/ResizeObserver 空实现 ——
const json = (data) => Promise.resolve({ status: 200, ok: true, json: async () => ({ ok: true, data }) });
const fetchStub = async (url) => {
  const u = String(url);
  if (u.includes("/settings")) return json(DEFAULT_SETTINGS);
  if (u.includes("/version")) return json({ installed: "0.17.1", latest: "0.17.1" });
  if (u.includes("/ai")) return json([]);
  if (u.includes("/tags")) return json([]);
  if (u.includes("/personas")) return json([]);
  return json([]);
};
w.fetch = fetchStub;
try { Object.defineProperty(globalThis, "fetch", { value: fetchStub, writable: true, configurable: true }); } catch {}
class NoopObserver { observe() {} unobserve() {} disconnect() {} }
w.ResizeObserver = globalThis.ResizeObserver = NoopObserver;
w.WebSocket = globalThis.WebSocket = class { close() {} send() {} addEventListener() {} removeEventListener() {} };

// —— 加载插件 bundle，取出 settings.section 注册的组件 ——
let mod = null;
w.__ModuleLoader__ = { load: (m) => { mod = m; } };
w.eval(readFileSync("lib/client.js", "utf8"));
if (!mod) throw new Error("client.js 没有调用 window.__ModuleLoader__.load");

const NullComponent = () => null;
const primitivesStub = new Proxy({}, { get: () => NullComponent });
const require = (spec) => {
  if (spec === "react") return React;
  if (spec === "react-dom") return ReactDOM;
  if (spec === "react/jsx-runtime") return jsxRuntime;
  if (spec.startsWith("@deepseek-ai/")) return primitivesStub;
  throw new Error("测试未桩住的依赖：" + spec);
};

let SettingsSection = null;
const injections = [];
/** apply() 会注册词典；捕获下来当作真实的翻译函数，避免取词落到「返回 key」的桩上。 */
let dict = null;
const translate = (key, params) => {
  let text = dict?.[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) text = text.split(`{${k}}`).join(String(v));
  return text;
};
const ctx = {
  effect: (fn) => { try { return fn(); } catch { return () => {}; } },
  locale: {
    register: (_ns, dicts) => { dict = dicts.zh; },
    bind: () => translate,
    subscribe: () => () => {},
  },
  slots: {
    inject: (name, factory) => { injections.push(name); return factory(); },
    register: (options, component) => {
      if (options.name === "settings.section") SettingsSection = component;
      return () => {};
    },
  },
  workspaces: { pickDirectory: async () => null, listDirectory: async () => ({}), createDirectory: async () => "" },
};
mod.factory(require).apply(ctx);
if (!SettingsSection) throw new Error("没有注册 settings.section 组件");

// —— 渲染（含错误边界：渲染期抛错会被抓住而不是崩测试） ——
class Boundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) return React.createElement("pre", { id: "render-error" }, String(this.state.err?.stack || this.state.err));
    return this.props.children;
  }
}
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(Boundary, null, React.createElement(SettingsSection, { t: translate })));
const tick = (ms = 150) => new Promise((r) => setTimeout(r, ms));
await tick();

const failures = [];
const check = (ok, label, extra = "") => {
  console.log((ok ? "  ✅ " : "  ❌ ") + label + (extra ? "  " + extra : ""));
  if (!ok) failures.push(label);
};

const boom = document.getElementById("render-error");
check(!boom, "设置页渲染无异常", boom ? "\n" + boom.textContent.slice(0, 600) : "");
const text = document.body.textContent || "";
check(text.includes("词库设置"), "设置页标题「词库设置」已渲染");
check(!document.querySelector("[data-pl-sa-wrap]"), "注入式按钮 [data-pl-sa-wrap] 不存在");

// —— 入口卡片：可点击（aria-haspopup=dialog），且排在设置页最底部 ——
const entries = [...document.querySelectorAll('[role="button"][aria-haspopup="dialog"]')];
const entry = entries.find((el) => (el.textContent || "").includes("回收站的统一入口"));
check(Boolean(entry), "存在「词库」入口卡片");
const sections = [...document.querySelectorAll("section")];
check(entry?.closest("section") === sections[sections.length - 1], "入口卡片位于设置页最底部（「关于」之后）");
check(document.querySelectorAll('[role="tab"]').length === 0, "未点击时没有面板");

// —— 点击入口 → 弹出独立面板 ——
entry?.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
await tick();

const panel = document.querySelector('[role="dialog"][aria-modal="true"]');
check(Boolean(panel), "点击后弹出独立面板");
check(panel?.parentElement === document.body, "面板独立于设置页（portal 到 body）");
const surface = panel?.querySelector(".pl-dialog");
check(surface?.style.width === "850px", "面板宽度 850px（不再被设置页 520px 列压扁）", surface?.style.width || "");
const tabs = [...document.querySelectorAll('[role="tab"]')].map((el) => (el.textContent || "").trim());
check(JSON.stringify(tabs) === JSON.stringify(["数据管理", "导入导出", "标签", "回收站"]), "面板内四个 Tab 正确", JSON.stringify(tabs));
const boom2 = document.getElementById("render-error");
check(!boom2, "面板打开后渲染无异常", boom2 ? "\n" + boom2.textContent.slice(0, 600) : "");
// 关键：功能模块要真的渲染进面板内容区（而不是只有 Tab 是空的）
const panelText = panel?.textContent || "";
check(panelText.includes("提示词列表"), "数据管理模块已内嵌进面板", panelText.includes("提示词列表") ? "" : panelText.slice(0, 120));

// Tab 图标：必须是真实的 SVG 节点（而不是空色块）
const tabIcons = [...document.querySelectorAll('[role="tab"]')].map((el) => {
  const svg = el.querySelector("svg");
  return { hasSvg: Boolean(svg), children: svg ? svg.children.length : 0 };
});
check(tabIcons.every((t) => t.hasSvg && t.children > 0), "四个 Tab 的图标都是真实 SVG",
  JSON.stringify(tabIcons));

// 回归防护：.pl-dialog *的 scrollbar-gutter 会把 svg 计算宽度压成 0（图标整块被裁掉），
// 必须带 `.pl-dialog svg{scrollbar-gutter:auto}` 这条修正（jsdom 不做布局，只能断言样式文本）
const panelCss = [...document.querySelectorAll("style")].map((el) => el.textContent || "").join("\n");
check(/\.pl-dialog svg\s*\{[^}]*scrollbar-gutter:\s*auto/.test(panelCss), "面板样式含 svg 宽度修正（scrollbar-gutter:auto）",
  /scrollbar-gutter/.test(panelCss) ? "" : "样式块里没找到 scrollbar-gutter");

// 最大化 / 还原
const maxBtn = panel ? [...panel.querySelectorAll("button")].find((b) => (b.getAttribute("data-tip") || "").includes("最大化")) : null;
check(Boolean(maxBtn), "面板有最大化按钮");
// 图标必须是上游浮动面板同款的内联 SVG 方块，而不是 🗖 文本字形（该字形在宿主环境会回退成怪符号）
check(Boolean(maxBtn?.querySelector("svg rect")), "最大化图标是 SVG 方块（非 🗖 字形）",
  maxBtn ? JSON.stringify(maxBtn.innerHTML.slice(0, 90)) : "");
maxBtn?.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
await tick();
check(Boolean(document.querySelector(".pl-dialog--max")), "点击最大化后面板铺满");
const restoreBtn = [...document.querySelectorAll("button")].find((b) => (b.getAttribute("data-tip") || "").includes("还原"));
check(Boolean(restoreBtn?.querySelector("svg path")), "还原图标是 SVG 双方块（非 🗗 字形）");
restoreBtn?.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
await tick();
check(!document.querySelector(".pl-dialog--max"), "可还原为居中面板");

// —— 关闭：✕ 与 Esc ——
const closeBtn = panel ? [...panel.querySelectorAll("button")].find((b) => (b.textContent || "").includes("✕")) : null;
check(Boolean(closeBtn), "面板有关闭按钮 ✕");
closeBtn?.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
await tick();
check(!document.querySelector('[role="dialog"][aria-modal="true"]'), "点 ✕ 后独立面板关闭");

entry?.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
await tick();
check(Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')), "再次点击入口可重新打开");
w.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
await tick();
check(!document.querySelector('[role="dialog"][aria-modal="true"]'), "Esc 可关闭面板");

console.log("");
if (failures.length) {
  console.error("❌ render test 失败：" + failures.join("；"));
  process.exit(1);
}
console.log("✅ render test 通过（入口卡片 → 独立面板 → 四个 Tab → ✕/Esc 关闭）");
process.exit(0);
