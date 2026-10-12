/**
 * 构建期由 esbuild define 折叠的全局量（见 scripts/build.mjs）。
 * 这里只做类型声明，不产生任何运行时产物。
 */
declare const __DEV__: boolean;
