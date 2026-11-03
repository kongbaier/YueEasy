/**
 * 区域焦点导航（zone focus）—— 平台基元，纯 DOM，无 React。
 *
 * 只对 **Tab / Shift+Tab** 做一件事：**走到区域边界时跳到相邻区域**，并落在该区域
 * 上次聚焦的条目上（没有则首/尾项）。**区域内的其它焦点行为全部是原生的** ——
 * Tab 逐项走、方向键滚动/快进快退、Home/End 滚到顶底，引擎一概不接管。
 *
 * ```
 * Tab / Shift+Tab  →  区域内：原生逐项；区域边界：跳到下一个区域的入口（带记忆）
 * 其它按键          →  完全不接管（方向键/Home/End 归浏览器与全局快捷键）
 * ```
 *
 * 为什么不用「漫游 tabindex」（roving tabindex）逐项改 `tabIndex`：
 * 区域是**结构**（容器本身通常不可聚焦，没有 tabIndex 可写）；而 `tabIndex` 只有
 * 「元素在 Tab 序列里排第几」这一层含义，表达不了「跨路由记住上次焦点项」「虚拟列表
 * 只挂载可见项」「浮层盖住的区域整体失效」。若强行用 tabIndex 表达，每个列表都要
 * 自带 activeIndex 状态并与引擎抢 DOM 所有权。这里改为**只在事件发生时**扫描可见性，
 * 元素自身的 `tabIndex` 保持 React 声明的那一份，零状态同步。
 *
 * 标记约定（写在 JSX 上，见 AGENTS.md §11）：
 * - `data-focus-zone`：一个「区域」（导航条 / 横幅 / 卡片栅格 / 歌曲列表 / 播放栏…）。
 *   区域内可聚焦控件自动成为条目，**区域之间**用 Tab 跳转。
 * - `data-focus-layer`：模态浮层根（播放页 / 队列抽屉…）。引擎自动负责
 *   ① 给外壳加 `inert`（被盖住的页面退出 Tab 序列与辅助技术树）、
 *   ② Tab 圈在浮层内（背景已 inert）、③ 关闭时把焦点还给打开前的控件。
 *   **不会**把焦点搬进浮层的某个条目（「打开就有一个控件是亮的」不是这里的语义）；
 *   需要「打开即聚焦第一项」的表单型浮层显式写 `data-focus-layer="focus"`。
 * - `data-focus-shell`：应用外壳（`AppLayout` 那层）。浮层在外壳外（如播放页）时整体
 *   inert 外壳；浮层在外壳内（如队列抽屉）时只 inert 沿途的兄弟分支，外层门户
 *   （`Toaster` 之类）保持可用。
 * - `data-focus-item`：让非原生可聚焦的点击面成为条目；也用于「整行/整卡本身是条目，
 *   内部还包着红心 / 专辑链接 / 删除按钮」的容器 —— 否则会被当作包裹层剔除。
 *
 * 与浏览器/组件自带行为的分工：
 * - 输入框（input / textarea / select / contenteditable）内的方向键与 Home/End 归控件本身；
 *   Tab 仍然走区域跳转（把焦点带出输入框）。
 * - base-ui 的浮层（`role="menu|listbox|dialog|…"`）内部完全放行：菜单用方向键选择、
 *   对话框自带焦点陷阱，均不能被区域导航抢走。
 * - 只有**真的移动了焦点**才消费按键（`preventDefault` + `stopPropagation`）：
 *   区域内 ← → 不会误触全局「快进/快退」，走到区域边界时按键又漏给全局快捷键。
 */

import { pruneContainers } from './structure';

const ZONE_ATTR = 'data-focus-zone';
const LAYER_ATTR = 'data-focus-layer';
const SHELL_ATTR = 'data-focus-shell';
const ITEM_ATTR = 'data-focus-item';

const ZONE_SELECTOR = `[${ZONE_ATTR}]`;
const LAYER_SELECTOR = `[${LAYER_ATTR}]`;
const SHELL_SELECTOR = `[${SHELL_ATTR}]`;

/** 区域内可成为条目的元素：原生可聚焦控件 + 显式标注的点击面。 */
const ITEM_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[tabindex]',
  `[${ITEM_ATTR}]`,
].join(',');

/** 自带键盘语义（方向键选择 / 焦点陷阱）的浮层角色：区域导航整体放行。 */
const NATIVE_OVERLAY_SELECTOR = [
  '[role="menu"]',
  '[role="menubar"]',
  '[role="listbox"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="tree"]',
  '[role="treegrid"]',
  '[role="grid"]',
].join(',');

/**
 * 鼠标按下的目标是否算「点在控件上」。不算的一律当**点空白**处理：
 * 交回浏览器默认行为 —— 焦点取消、回到 body（这正是用户对「点空白」的预期）。
 *
 * 刻意排除 `tabindex="-1"` 的结构壳（SimpleBar 的滚动层、rail 之类），
 * 否则整块滚动区都会被当成控件，点空白就再也取消不了焦点。
 */
const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[data-focus-item]',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="option"]',
  '[role="switch"]',
].join(',');

/** 区域 → 上次聚焦的条目（Tab 回到区域时落在这里）。 */
const lastFocused = new WeakMap<Element, HTMLElement>();

/**
 * 焦点模态：写在 `<html data-focus-mode>` 上，CSS 用它决定要不要画焦点环。
 *
 * 为什么不让浏览器自己判断（`:focus-visible`）：它的启发式是「最近一次交互是不是键盘」，
 * 所以**鼠标点过的按钮在按下任意键（包括数字键）后会被补画焦点环** ——
 * 表现为「莫名其妙被按了个数字就 focus 了」。这里把规则收紧成：
 * 只有**焦点导航键**（Tab / 方向键 / Home / End）或程序化搬焦点才算键盘模态，
 * 鼠标按下立即回到 pointer 模态。
 */
type FocusModality = 'keyboard' | 'pointer';
const MODALITY_ATTR = 'data-focus-mode';
let modality: FocusModality | null = null;

const setModality = (next: FocusModality) => {
  if (modality === next) return;
  modality = next;
  document.documentElement.setAttribute(MODALITY_ATTR, next);
};

/* ------------------------------------------------------------------ */
/*  DOM 判定                                                           */
/* ------------------------------------------------------------------ */

/**
 * 可见性粗筛（长列表里每次按键都要跑一遍，必须便宜）。
 *
 * `checkVisibility` 一次拿到 display:none / visibility:hidden / content-visibility 的结论；
 * 被模态浮层 `inert` 盖住的背景也在这里整体失效（退出 Tab 序列 + 辅助技术树）。
 * 零尺寸（未渲染 / 被隐藏）的条目在几何选择里再过滤。
 */
const isVisible = (el: Element): boolean => {
  if (!el.isConnected) return false;
  if (el.closest('[inert]')) return false;
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility({ visibilityProperty: true });
  }
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return getComputedStyle(el).visibility !== 'hidden';
};

const isDisabled = (el: HTMLElement): boolean =>
  el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';

/** 文本输入类控件：方向键 / Home / End 属于控件本身。 */
const isTextEntry = (el: HTMLElement): boolean => {
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(
    (el as HTMLInputElement).type,
  );
};

/**
 * 该元素是不是「自己在吃键盘」的文本输入类控件
 * （输入框内的方向键 / Home / End / 空格都归控件本身）。
 */
export const isTypingTarget = (el: Element | null): boolean =>
  el instanceof HTMLElement && isTextEntry(el);

/**
 * 该元素是否在自带键盘语义的浮层里（菜单 / 下拉 / 对话框）。
 * 这些控件自己处理空格与方向键，区域导航与全局快捷键都要放行。
 */
export const isNativeKeyboardZone = (el: Element | null): boolean =>
  Boolean(el?.closest(NATIVE_OVERLAY_SELECTOR));

const zoneOf = (el: Element | null): Element | null =>
  el?.closest(ZONE_SELECTOR) ?? null;

/* ------------------------------------------------------------------ */
/*  区域与条目收集                                                     */
/* ------------------------------------------------------------------ */

/**
 * 剔除「包裹层」：可聚焦、又包着其他条目的元素是容器而不是条目
 * （滚动卡槽、组件库外层 wrapper…），除非显式标了 `data-focus-item`。
 * 规则本体见 `./structure`（纯函数，有单测）。
 */
const dropWrappers = (items: HTMLElement[], zone: Element): HTMLElement[] =>
  pruneContainers(items, {
    parentOf: (el) => {
      const parent = el.parentElement;
      return parent && parent !== zone ? parent : null;
    },
    isPinned: (el) => el.hasAttribute(ITEM_ATTR),
  });

/**
 * 区域内条目（文档顺序）。
 *
 * - 过滤隐藏 / 禁用 / `inert` 子树 / 不属于本区域（内层区域）的元素；
 * - 区域自身与结构包裹层永远不是条目（见 `dropWrappers`）；
 * - 显式标 `data-focus-item` 的「整行 / 整卡」既是条目，行内子条目也仍是条目。
 */
const zoneItems = (zone: Element): HTMLElement[] => {
  const items: HTMLElement[] = [];
  const nodes = zone.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
  for (const el of nodes) {
    if (isDisabled(el)) continue;
    // tabIndex=-1 的元素只能被程序聚焦，不是导航目标；显式标注的除外
    if (el.tabIndex < 0 && !el.hasAttribute(ITEM_ATTR)) continue;
    if ((el.parentElement?.closest(ZONE_SELECTOR) ?? null) !== zone) continue;
    if (!isVisible(el)) continue;
    items.push(el);
  }
  return dropWrappers(items, zone);
};

const visibleZonesIn = (root: Element): Element[] =>
  Array.from(root.querySelectorAll(ZONE_SELECTOR)).filter(isVisible);

/** 最上层可见浮层（`data-focus-layer`），没有则 null。 */
const topLayer = (): Element | null => {
  const layers = Array.from(document.querySelectorAll(LAYER_SELECTOR)).filter(
    isVisible,
  );
  return layers.at(-1) ?? null;
};

/* ------------------------------------------------------------------ */
/*  焦点移动                                                           */
/* ------------------------------------------------------------------ */

const focusElement = (el: HTMLElement) => {
  setModality('keyboard');
  el.focus({ preventScroll: true });
  // 虚拟列表外的条目需要滚进视口：SimpleBar 走原生 overflow，scrollIntoView 有效
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
};

/** 文档顺序比较：`node` 是否在 `anchor` 之后。 */
const isAfter = (node: Element, anchor: Element): boolean =>
  Boolean(
    anchor.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
  );

/** 区域的入口条目：上次焦点项（仍有效时）→ 行进方向上的首/尾项。 */
const entryOf = (zone: Element, forward: boolean): HTMLElement | null => {
  const items = zoneItems(zone);
  if (items.length === 0) return null;
  const remembered = lastFocused.get(zone);
  if (remembered && items.includes(remembered)) return remembered;
  return forward ? items[0] : items[items.length - 1];
};

/**
 * Tab 的遍历范围：有浮层时只在浮层内（即使 `inert` 不可用也不会跑到背景里去），
 * 没有浮层时是整页。
 */
const zonesForTab = (): Element[] =>
  visibleZonesIn(topLayer() ?? document.body);

/**
 * 焦点是否已经在该区域「该出区域」的那一头。
 *
 * 区域内是原生 Tab（逐项走），只有处在边界上时这一步 Tab 才需要跳到相邻区域。
 */
const atZoneEdge = (active: Element, forward: boolean): boolean => {
  const zone = zoneOf(active);
  if (!zone) return true;
  const items = zoneItems(zone);
  const index = items.indexOf(active as HTMLElement);
  if (index < 0) return true;
  return forward ? index === items.length - 1 : index === 0;
};

/** Tab / Shift+Tab：走到区域边界时跳到相邻区域的入口（带记忆），两端环绕。 */
const jumpToZone = (active: Element | null, forward: boolean): boolean => {
  const zones = zonesForTab();
  if (zones.length === 0) return false;

  // 区域内还有条目：不接管，交回原生逐项走
  if (active && !atZoneEdge(active, forward)) return false;

  // 焦点在 body（没聚焦任何控件）时按「无焦点」处理：直接进出首/尾区域
  const from = active && active !== document.body ? active : null;
  const currentZone = zoneOf(from);
  const currentIndex = currentZone ? zones.indexOf(currentZone) : -1;
  const step = forward ? 1 : -1;

  // 从当前区域 / 当前焦点的文档位置出发，按顺序找第一个有可用入口的区域
  const start =
    currentIndex >= 0
      ? currentIndex + step
      : !from
        ? forward
          ? 0
          : zones.length - 1
        : forward
          ? zones.findIndex((zone) => isAfter(zone, from))
          : zones.findLastIndex((zone) => isAfter(from, zone));

  const begin =
    start < 0
      ? forward
        ? 0
        : zones.length - 1
      : (start + zones.length) % zones.length;

  for (let i = 0; i < zones.length; i += 1) {
    const index = (begin + i * step + zones.length) % zones.length;
    const zone = zones[index];
    if (zone === currentZone) continue;
    const entry = entryOf(zone, forward);
    if (!entry) continue;
    focusElement(entry);
    return true;
  }
  return false;
};

/* ------------------------------------------------------------------ */
/*  模态浮层：inert 背景 + 焦点交接                                     */
/* ------------------------------------------------------------------ */

/** 本模块加上的 inert（关闭浮层时逐个还原，不误伤别人加的 inert）。 */
let inerted: HTMLElement[] = [];

const resetInert = () => {
  for (const el of inerted) el.inert = false;
  inerted = [];
};

const markInert = (el: Element) => {
  const target = el as HTMLElement;
  if (target.inert) return; // 已经是 inert（别人加的）就别记录，免得还原时误清
  target.inert = true;
  inerted.push(target);
};

/**
 * 把「浮层之外的界面」标成 inert —— 原生语义：退出 Tab 序列、退出辅助技术树、
 * 不接收指针事件。比在引擎里逐个跳过背景区域更标准，也让屏幕阅读器读不到被盖住的内容。
 */
const applyLayerInert = (layer: Element | null) => {
  resetInert();
  if (!layer) return;

  const shell = document.querySelector(SHELL_SELECTOR);
  if (!shell) {
    if (import.meta.env.DEV) {
      console.warn(
        '[focus] 存在 data-focus-layer 浮层但找不到 data-focus-shell（AppLayout 外壳），背景不会被 inert。',
      );
    }
    return;
  }

  // 浮层在外壳外（播放页这种兄弟层）：整个外壳 inert
  if (!shell.contains(layer)) {
    markInert(shell);
    return;
  }

  // 浮层在外壳内（队列抽屉）：只 inert 沿途的兄弟分支，外壳与其他门户（Toaster）保持可用
  let cursor: Element | null = layer;
  while (cursor && cursor !== shell) {
    const branch: Element | null = cursor.parentElement;
    if (!branch) break;
    for (const sibling of Array.from<Element>(branch.children)) {
      if (sibling === cursor || sibling.hasAttribute(LAYER_ATTR)) continue;
      markInert(sibling);
    }
    cursor = branch;
  }
};

/**
 * 浮层是否**显式**要求「打开即聚焦」：`data-focus-layer="focus"`。
 *
 * 默认不搬焦点。播放页 / 队列抽屉这类浮层是「整块视图」，不是表单对话框，
 * 自动聚焦只会打在文档序第一个可聚焦控件上（返回键、清空播放列表…），
 * 表现为「一打开就有个控件亮着」，`scrollIntoView` 还可能把列表滚走。
 * 焦点交给用户：焦点在 body 时第一步 Tab 就会进浮层首个区域（`zonesForTab` 已收在浮层内）。
 */
const wantsFocusOnOpen = (layer: Element): boolean =>
  layer.getAttribute(LAYER_ATTR) === 'focus';

/** 打开前的焦点位置：浮层关闭时还给它（开关浮层不该让键盘用户丢掉原地）。 */
let focusBeforeLayer: HTMLElement | null = null;

const captureFocusBeforeLayer = () => {
  const active = document.activeElement;
  focusBeforeLayer =
    active instanceof HTMLElement && active !== document.body ? active : null;
};

const restoreFocusAfterLayer = () => {
  const target = focusBeforeLayer;
  focusBeforeLayer = null;
  if (!target || !target.isConnected || !isVisible(target)) return;
  // 用户已经在别处建立了焦点（点开了别的控件）就别抢回来
  const active = document.activeElement;
  if (active && active !== document.body) return;
  target.focus({ preventScroll: true });
};

/** 浮层打开时的焦点入口（仅在 `data-focus-layer="focus"` 时使用）：首个区域的第一项。 */
const focusIntoLayer = (layer: Element): boolean => {
  for (const zone of visibleZonesIn(layer)) {
    const entry = entryOf(zone, true);
    if (!entry) continue;
    focusElement(entry);
    return true;
  }
  return false;
};

/* ------------------------------------------------------------------ */
/*  开发期护栏                                                         */
/* ------------------------------------------------------------------ */

let warnedCount = 0;
const warned = new WeakSet<Element>();

/**
 * 漏标 `data-focus-zone` 的后果是「控件键盘完全不可达」，而且是静默的 ——
 * 这里在开发期把「页面里可聚焦、却不在任何区域内的控件」打出来（去重、限量）。
 */
const warnUnzonedControls = () => {
  if (!import.meta.env.DEV || warnedCount > 200) return;
  const root = document.querySelector('main') ?? document.body;
  for (const el of root.querySelectorAll<HTMLElement>(ITEM_SELECTOR)) {
    if (warnedCount > 200) return;
    if (warned.has(el)) continue;
    if (el.tabIndex < 0 || isDisabled(el) || !isVisible(el)) continue;
    if (el.closest(ZONE_SELECTOR) || el.closest(NATIVE_OVERLAY_SELECTOR))
      continue;
    warned.add(el);
    warnedCount += 1;
    console.warn(
      '[focus] 可聚焦控件不在任何 data-focus-zone 内：区域边界的 Tab 跳转会跳过它，键盘可能到不了；请给它所在的内容块标 data-focus-zone（见 AGENTS.md §11）。',
      el,
    );
  }
};

/* ------------------------------------------------------------------ */
/*  事件接管                                                           */
/* ------------------------------------------------------------------ */

/**
 * 安装全局键盘接管，返回卸载函数。
 *
 * 只在 `document` 捕获阶段介入：这样组件（React 合成事件）与全局快捷键
 * （`window` 冒泡阶段的播放器快捷键）都收不到已被焦点导航消费的按键。
 */
export const installFocusNavigation = (): (() => void) => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    // 组合键留给系统 / 应用（Ctrl+Tab、Alt+← 等）
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    // 引擎只处理 Tab；方向键 / Home / End 全部原生
    if (event.key !== 'Tab') return;

    // Tab 是焦点导航 → 键盘模态（焦点环只在键盘导航后出现）
    setModality('keyboard');

    const active =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // 浮层（菜单 / 下拉 / 对话框）自带键盘语义，全部放行（模态已切到 keyboard）
    if (active?.closest(NATIVE_OVERLAY_SELECTOR)) return;

    warnUnzonedControls();
    // 区域内：交回原生逐项走；只有走到区域边界才跳去相邻区域
    if (!jumpToZone(active, !event.shiftKey)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  /** 记住每个区域最后聚焦的条目，Tab 回来时落在这里（鼠标点过的也算）。 */
  const handleFocusIn = (event: FocusEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const zone = zoneOf(target);
    if (zone) lastFocused.set(zone, target);
  };

  /**
   * 鼠标点击不抢焦点（focus follows keyboard）。
   *
   * 浏览器默认在 mousedown 时把焦点搬到控件上：于是「点过的按钮」会留下 `:focus`，
   * 之后按任意键（包括 Tab / 空格 / 回车）都被这个残留焦点接住 —— 表现为
   * 「键盘按键把控件 focus 了」，甚至重新触发一次点击。这里取消 mousedown 的默认行为，
   * 焦点就只由键盘（区域导航）与程序化调用（浮层搬焦点）决定。
   *
   * 只拦截「点在控件上」的按下；点**空白处**保持原生行为，于是鼠标点空白会取消
   * 键盘焦点（焦点回到 body），符合「Tab 建立焦点、点空白撤销焦点」的预期。
   *
   * 其余全部放行：文本输入类（点击要落光标）、自带键盘语义的浮层（菜单/下拉/对话框）、
   * 带修饰键的点击（Ctrl/Cmd+点击的「新窗口打开」等语义）。
   */
  const handleMouseDown = (event: MouseEvent) => {
    // 任何鼠标交互都离开键盘模态：焦点环随之消失
    setModality('pointer');
    if (event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (isTypingTarget(target) || isNativeKeyboardZone(target)) return;

    // 点空白：不拦，让浏览器照常把焦点收走（= 取消焦点）
    if (!target.closest(INTERACTIVE_SELECTOR)) return;

    // 点到别处时把输入框「收尾」：否则焦点留在搜索框里，之后打的字还进搜索框
    const active = document.activeElement;
    if (active instanceof HTMLElement && isTypingTarget(active)) active.blur();

    event.preventDefault();
  };

  // 浮层的出现 / 移除（含退出动画结束）都表现为 DOM 变动：只在「最上层浮层变了」时才干活，
  // 常规列表重渲染的 childList 变动会被 topLayer() 的同一性判断挡掉。
  let lastTopLayer: Element | null = null;
  const syncLayer = () => {
    const top = topLayer();
    if (top === lastTopLayer) return;
    const previous = lastTopLayer;
    lastTopLayer = top;
    // 只在「无浮层 → 有浮层」时记录焦点；浮层之间切换不覆盖（那时焦点已在浮层里）
    if (top && !previous) captureFocusBeforeLayer();
    applyLayerInert(top);
    if (top) {
      if (wantsFocusOnOpen(top)) focusIntoLayer(top);
    } else if (previous) {
      restoreFocusAfterLayer();
    }
  };

  const observer = new MutationObserver(syncLayer);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributeFilter: [LAYER_ATTR],
  });

  // 初始给键盘模态：首帧/首 Tab 就能正常显示焦点环
  setModality('keyboard');

  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('mousedown', handleMouseDown, true);
  // 安装时可能已有浮层开着（StrictMode 重装 / HMR）
  syncLayer();

  return () => {
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('focusin', handleFocusIn, true);
    document.removeEventListener('mousedown', handleMouseDown, true);
    observer.disconnect();
    lastTopLayer = null;
    focusBeforeLayer = null;
    applyLayerInert(null);
    document.documentElement.removeAttribute(MODALITY_ATTR);
    modality = null;
  };
};
