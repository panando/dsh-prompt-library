/**
 * AI 完善（refine）结果的容错解析。
 *
 * ⚠️ 本文件是从上游 npm 包**反推重建**的：上游 lib/index.js.map 的 sourcesContent 里没有
 * 这个文件，因为它在打包时被完全 tree-shake 掉了（唯一调用方 enrichLearnedPrompt 未被
 * 宿主注册），既不在产物里也不在 sourcemap 的 sources 里，无法从产物还原。
 *
 * 这里依据两处线索重建，保证与上游行为一致：
 *   1. 调用方 src/host/ai.ts 的 parseJson()：返回 { title, tags[], summary, body } 或 undefined；
 *   2. 同族解析器 parseSummaryJson() / parseSkillJson() 的写法与日志文案
 *      （pl:parse:ok title=… tags=[…] summary length=… rewritten body length=…）。
 *
 * 因为该模块在产物中不贡献任何字节，重建不影响构建产物（可由 lib/index.js 与上游逐字节一致证明）。
 */

/** AI 完善结果：标题 / 标签 / 用途摘要 / 改写后的正文。 */
export interface AiRefineResult {
  title: string;
  tags: string[];
  summary: string;
  body: string;
}

/**
 * 从模型输出中容错解析完善结果。
 *
 * 容错点：允许整体被 Markdown 代码块包裹；允许 JSON 前后夹杂解释文字（取首尾花括号之间）；
 * 任一必需字段缺失即视为失败（返回 undefined），由调用方放弃本次完善。
 */
export function parseRefineResult(text: string): AiRefineResult | undefined {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    const obj = JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
    const title = typeof obj.title === "string" ? obj.title.trim() : "";
    const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
    const body = typeof obj.body === "string" ? obj.body.trim() : "";
    if (!body) return undefined;
    const tags = Array.isArray(obj.tags)
      ? obj.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean)
      : [];
    return { title, tags, summary, body };
  } catch {
    return undefined;
  }
}
