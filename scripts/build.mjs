/**
 * build.mjs — 构建本插件的两份产物。
 *
 * 产物与上游 npm 包保持一致：
 *   lib/client.js  浏览器端：esbuild CJS 包体 + window.__ModuleLoader__.load 外壳
 *   lib/index.js   宿主端：esbuild ESM（js-yaml 内联；@deepseek-ai/* 与 node:* 外置）
 *
 * 用法：node scripts/build.mjs [--dev]
 */
import { build } from "esbuild";
import { readFileSync } from "node:fs";

/** 版本号注入（与上游 lib/index.js 的 __PLUGIN_VERSION__ 分支一致）。 */
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const NS = "@sunjuntao/dsh-prompt-library";
const dev = process.argv.includes("--dev");

/** 客户端外壳：DSH 客户端模块加载器协议（banner/footer 必须保持与上游一致）。 */
const CLIENT_BANNER = [
  "window.__ModuleLoader__.load({",
  `\tid: "${NS}",`,
  "\tfactory: (require) => {",
  "\t\tvar module = { exports: {} };",
  "\t\tvar exports = module.exports;",
].join("\n");

const CLIENT_FOOTER = [
  "\t\tmodule.exports = { apply, inject };",
  "\t\treturn module.exports;",
  "\t}",
  "});",
  "",
].join("\n");

const common = {
  bundle: true,
  sourcemap: true,
  logLevel: "info",
  minify: false,
  define: {
    // 这两个全局量由构建期折叠：__DEV__ 在发布构建里为 false（源码写作 if (!__DEV__) return）
    __DEV__: dev ? "true" : "false",
    __PLUGIN_VERSION__: JSON.stringify(version),
  },
};

await build({
  ...common,
  entryPoints: ["src/client/utils/index.ts"],
  outfile: "lib/client.js",
  format: "cjs",
  platform: "browser",
  jsx: "automatic",
  external: ["react", "react-dom", "react/jsx-runtime", "@deepseek-ai/*"],
  banner: { js: CLIENT_BANNER },
  footer: { js: CLIENT_FOOTER },
});

await build({
  ...common,
  entryPoints: ["src/index.ts"],
  outfile: "lib/index.js",
  format: "esm",
  platform: "node",
  target: "node22",
  external: ["@deepseek-ai/*", "node:*"],
});
