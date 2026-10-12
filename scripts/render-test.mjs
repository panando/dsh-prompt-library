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

const headers = [...document.querySelectorAll('[role="button"][aria-expanded]')];
// 注意：「AI 模型」的说明里也含「词库」二字，这里按本卡片独有的说明文案精确定位
const card = headers.find((el) => (el.textContent || "").includes("回收站的统一入口"));
check(Boolean(card), "存在「词库」折叠项", card ? `（共 ${headers.length} 个分类项）` : "");
check(headers[headers.length - 1] === card, "折叠项位于设置页最底部（「关于」之后）");
const cardOrder = headers.map((el) => (el.textContent || "").split("数据")[0].slice(0, 6));
console.log("     分类顺序：" + cardOrder.join(" / "));
check(document.querySelectorAll('[role="tab"]').length === 0, "默认折叠：展开前没有 Tab");

if (card) {
  card.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick();
  const tabs = [...document.querySelectorAll('[role="tab"]')].map((el) => (el.textContent || "").trim());
  const want = ["数据管理", "导入导出", "标签", "回收站"];
  check(JSON.stringify(tabs) === JSON.stringify(want), "展开后四个 Tab 正确", JSON.stringify(tabs));
  const boom2 = document.getElementById("render-error");
  check(!boom2, "展开后渲染无异常", boom2 ? "\n" + boom2.textContent.slice(0, 600) : "");
}

console.log("");
if (failures.length) {
  console.error("❌ render test 失败：" + failures.join("；"));
  process.exit(1);
}
console.log("✅ render test 通过（设置页渲染 + 折叠项 + 四个 Tab）");
process.exit(0);
