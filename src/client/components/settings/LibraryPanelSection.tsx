/**
 * 「词库」面板内容 — 设置页内嵌版。
 *
 * 取代原先注入到宿主原生「设置」按钮上方的浮动面板：入口收敛为「词库设置」页里的
 * 一条折叠项（与 AI 模型 / 面板显示 / 显示与交互 / 关于 同款式），展开后在这里直接
 * 渲染 数据管理 / 导入导出 / 标签 / 回收站 四个功能。
 *
 * 与旧实现的三点差异：
 * 1. 不再用 MutationObserver 往宿主 DOM 里插按钮 —— 那种做法会让同一个按钮同时长在
 *    设置导航顶部和侧边栏左下角菜单里，两处都突兀且无法只关一处；
 * 2. 不再经 `pl:show-panel-content` 窗口事件 + PromptAssistant 中转，直接渲染，
 *    因此不依赖会话页是否挂载；
 * 3. 不再有遮罩 / 最大化 / 关闭按钮 —— 收起折叠项即卸载内容。
 */
import { useState, type ReactNode } from "react";
import { type PLKey, type PLTranslate, usePLT } from "../../utils/i18n.js";
import { PL_DIALOG_CSS } from "../../utils/dialog-style.js";
import { getTone, useThemeSync } from "../../utils/theme.js";
import { LexiconManagerModal } from "../data/LexiconManagerModal.js";
import { ImportExportModal } from "../import-export/ImportExportModal.js";
import { TagManagePanel } from "../data/TagManagePanel.js";
import { RecycleManagePanel } from "../data/RecycleManagePanel.js";
import { PanelHeader } from "../common/PanelHeader.js";

/** 导航项（沿用旧浮动面板的四项与配色）。 */
interface NavItem {
  id: string;
  /** i18n 键（用 PLKey 收窄，保证 T(labelKey) 类型安全）。 */
  labelKey: PLKey;
  iconBg: string;
  iconColor: string;
  /** 图标内部子元素（16 视口、描边 1.3）。 */
  iconBody: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "lexicon",
    labelKey: "pl.ctx.dataManagement",
    iconBg: "rgba(37, 99, 235, .12)",
    iconColor: "var(--dsw-alias-brand-primary,#2563eb)",
    iconBody: '<rect x="2.5" y="2.5" width="4.6" height="4.6" rx="1.1"/><rect x="8.9" y="2.5" width="4.6" height="4.6" rx="1.1"/><rect x="2.5" y="8.9" width="4.6" height="4.6" rx="1.1"/><rect x="8.9" y="8.9" width="4.6" height="4.6" rx="1.1"/>',
  },
  {
    id: "importExport",
    labelKey: "pl.moduleImportExport",
    iconBg: "rgba(37, 99, 235, .12)",
    iconColor: "var(--dsw-alias-brand-primary,#2563eb)",
    iconBody: '<path d="M8 12V4M8 4L5 7M8 4l3 3M8 12l-3-3M8 12l3-3"/>',
  },
  {
    id: "tags",
    labelKey: "pl.ctx.tags",
    iconBg: "rgba(234, 88, 12, .12)",
    iconColor: "#ea580c",
    iconBody: '<path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h4.6c.4 0 .8.15 1.1.44l7 6.1a1.6 1.6 0 0 1 0 2.34l-5.7 5.7a1.6 1.6 0 0 1-2.34 0l-6.1-7A2.5 2.5 0 0 1 3 9.1V5.5Z"/><circle cx="7.4" cy="7.4" r="1.2"/>',
  },
  {
    id: "trash",
    labelKey: "pl.ctx.trash",
    iconBg: "rgba(220, 38, 38, .1)",
    iconColor: "var(--dsw-alias-state-error-primary,#dc2626)",
    iconBody: '<path d="M5 6.5h14M9 6.5V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8v1.7M6.5 6.5l.7 12a1 1 0 0 0 1 .9h7.6a1 1 0 0 0 1-.9l.7-12M9.5 10v5M14.5 10v5"/>',
  },
];

/** 内嵌内容区高度（px）：内嵌 Modal 依赖确定高度铺满并自行滚动。 */
const CONTENT_HEIGHT = 560;

/**
 * 内嵌内容区的布局契约（与旧浮动面板一致）：
 * 内容区是确定高度的 flex 列，Modal 的 [role=dialog] 与 .pl-dialog 依次撑满。
 * 内嵌态下 Modal 不会自己注入 PL_DIALOG_CSS，所以这里必须带上。
 */
const PANEL_CSS = `
.pl-lib-content{flex:1;min-width:0;min-height:0;overflow:hidden;padding:5px;position:relative;display:flex;flex-direction:column}
.pl-lib-content > [role="dialog"]{flex:1;min-height:0;display:flex;flex-direction:column}
.pl-lib-content > [role="dialog"] > .pl-dialog{flex:1;min-height:0;height:auto}
.pl-lib-tab{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:1 0 auto;padding:7px 12px;border:none;border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer;user-select:none;white-space:nowrap;transition:background .12s ease}
.pl-lib-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08))}
.pl-lib-tab[aria-selected="true"]{background:var(--dsw-alias-interactive-bg-active,rgba(127,127,127,.14))}
${PL_DIALOG_CSS}
`;

/** 按导航项渲染对应功能：能内嵌的 Modal 交给 container，纯面板直接渲染。 */
function renderModule(
  key: string,
  T: PLTranslate,
  host: HTMLElement,
  onRequestClose: () => void,
): ReactNode {
  switch (key) {
    case "lexicon":
      return <LexiconManagerModal open onClose={onRequestClose} t={T} container={host} />;
    case "importExport":
      return <ImportExportModal open onClose={onRequestClose} t={T} container={host} />;
    case "tags":
      return (
        <>
          <PanelHeader title={T("pl.moduleTags")} desc={T("pl.moduleTagsDesc")} />
          <TagManagePanel t={T} />
        </>
      );
    case "trash":
      return (
        <>
          <PanelHeader title={T("pl.moduleTrash")} desc={T("pl.moduleTrashDesc")} />
          <RecycleManagePanel t={T} />
        </>
      );
    default:
      return null;
  }
}

/** 「词库」折叠项展开后的内容体（顶部 Tab + 下方功能区）。 */
export function LibraryPanelContent(props: {
  t?: PLTranslate;
  /** 内嵌 Modal 请求关闭时（如导入完成）收起折叠项。 */
  onRequestClose?: () => void;
}): ReactNode {
  const { t, onRequestClose } = props;
  const T = usePLT(t);
  const TONE = getTone();
  useThemeSync();
  const [activeKey, setActiveKey] = useState<string>(NAV_ITEMS[0]!.id);
  // 内嵌 Modal 需要真实 DOM 容器：ref 回调拿到元素后再渲染，避免首帧传 null 落到 document.body
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const close = (): void => onRequestClose?.();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <style>{PANEL_CSS}</style>
      {/* 顶部横向 Tab：与旧面板一致的四项功能 */}
      <div
        role="tablist"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexShrink: 0,
          padding: "2px 0 10px",
          borderBottom: `1px solid ${TONE.border}`,
          overflowX: "auto",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeKey;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className="pl-lib-tab"
              style={{ color: TONE.text }}
              onClick={() => setActiveKey(item.id)}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  flexShrink: 0,
                  background: item.iconBg,
                  color: item.iconColor,
                }}
                dangerouslySetInnerHTML={{
                  __html: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${item.iconBody}</svg>`,
                }}
              />
              <span>{T(item.labelKey)}</span>
            </button>
          );
        })}
      </div>
      {/* 功能内容区：确定高度 + 内部滚动 */}
      <div style={{ height: CONTENT_HEIGHT, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div className="pl-lib-content" ref={setHost}>
          {host ? renderModule(activeKey, T, host, close) : null}
        </div>
      </div>
    </div>
  );
}
