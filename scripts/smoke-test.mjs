/**
 * smoke-test.mjs — 在 jsdom 里加载 lib/client.js，验证插件能注册出预期 UI 座位。
 *
 * 这是"能 import + 真注册"的证据：不依赖浏览器，跑 node scripts/smoke-test.mjs。
 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  runScripts: "outside-only",
  url: "http://localhost/",
});

let mod = null;
dom.window.__ModuleLoader__ = { load: (m) => { mod = m; } };
dom.window.eval(readFileSync("lib/client.js", "utf8"));

if (!mod) throw new Error("client.js 没有调用 window.__ModuleLoader__.load");
const { name: pkgName } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
if (mod.id !== pkgName) throw new Error("模块 id 与 package.json#name 不一致：" + mod.id + " vs " + pkgName);

/** @deepseek-ai/* 运行时包在测试里用万能桩替代（组件不渲染，只需要能取到属性）。 */
const anyStub = new Proxy(function () {}, {
  get: (_t, k) => (k === "__esModule" ? true : anyStub),
  apply: () => anyStub,
  construct: () => ({}),
});

const require = (spec) => {
  // react / react-dom 只在组件渲染时才被真正调用；本测试只跑 apply()，用万能桩即可
  if (spec.startsWith("@deepseek-ai/") || spec === "react" || spec === "react-dom" || spec.startsWith("react/")) {
    return anyStub;
  }
  throw new Error("测试未桩住的依赖：" + spec);
};

const exported = mod.factory(require);
if (typeof exported?.apply !== "function") throw new Error("factory 没有导出 apply()");

// —— 用 mock ctx 跑一次 apply，记录注册出来的座位 ——
const registered = [];
const injections = [];
const ctx = {
  effect: (fn, label) => { try { return fn(); } catch { /* 测试环境缺宿主能力，忽略 */ } },
  locale: {
    register: () => {},
    bind: () => (key) => key,
    subscribe: () => () => {},
  },
  slots: {
    inject: (name, factory) => { injections.push(name); return factory(); },
    register: (options) => { registered.push(`${options.name}#${options.id ?? options.key ?? ""}`); return () => {}; },
  },
  workspaces: { pickDirectory: async () => null, listDirectory: async () => ({}), createDirectory: async () => "" },
  uiConversation: undefined,
};

try {
  exported.apply(ctx);
} catch (err) {
  console.error("apply() 抛错：", err);
  process.exit(1);
}

console.log("inject 的插槽：", [...new Set(injections)].sort().join(", "));
console.log("注册的座位：");
for (const r of registered.sort()) console.log("  - " + r);

const expected = [
  "conversation.input.left#prompt-library",
  "conversation.input.left#prompt-library-ai-polish",
  "conversation.input.dock#prompt-library-recommend",
  "settings.section#prompt-library",
];
const missing = expected.filter((e) => !registered.includes(e));
if (missing.length) {
  console.error("缺少预期座位：" + missing.join(", "));
  process.exit(1);
}
console.log("\n✅ smoke test 通过（预期座位均已注册）");
// 插件会留下定时器 / MutationObserver，测试里显式退出，避免进程挂住
process.exit(0);
