/**
 * 视图转场（View Transitions）—— 平台基元，纯 DOM，无 React。
 *
 * 浏览器给 SPA 补上的「系统级 push/pop」：`document.startViewTransition(update)`
 * 先给**旧状态**拍一张快照 → 执行 DOM 变更（update）→ 再拍**新状态** → 两张快照
 * 在顶层伪元素树里做动画。这正是原生导航转场能免费拿到的那个能力：
 * 转场期间旧视图还在（以快照形式），所以「飞出去的封面 / 淡出的旧页面」才有可能。
 *
 * 为什么需要它：React 路由换代时旧树是**立刻卸载**的，`AnimatePresence` 之外没有任何
 * 机制能让新旧两页同时可见；而共享元素要飞来飞去，靠 portal + 手动算坐标（还要处理祖先
 * `overflow: hidden` 裁剪、z-index 层级）。快照树在 **top layer** 里，天然免疫裁剪与层级。
 *
 * 两种用法，按「谁发起转场」区分：
 *
 * | 场景         | 发起方                                     |
 * | ------------ | ------------------------------------------ |
 * | 路由切页     | `KeepAliveRouteOutlet` 的 `viewTransition` |
 * | 进出播放页   | 同上（`RouteViewTransition` 标 player 种类） |
 * | 主题切换     | `useThemeSync`                             |
 *
 * 转场只做一件事：**让共享元素从旧位置飞到新位置**。页面本体（root 快照）是瞬时
 * 切换的 —— 不给整窗做淡入淡出，也不给内容区做位移（见 assets/css/view-transitions.css）。
 *
 * 铁律（每条都有具体的坏结果）：
 * - **名字只写在 `style` 里，经 `vtName()` 生成**（见 `names.ts`）：命令式改 DOM 会造出
 *   第二套真相，而且仲裁时机必然落在两张快照之间。
 * - **同一张快照里不能有两个同名元素**（浏览器静默 abort 整场转场），由
 *   `checkViewTransitionNames()` 在开发期断言。
 * - **转场期间不要给页面加自己的进场动画**：快照拍的是「DOM 刚变更那一帧」，
 *   页面自己的 `animation` 会把动画的第一帧烤进快照，出现两套动画叠加的鬼影。
 *   转场归转场、页面内部动画归页面内部，互斥。
 * - **页面本体不做动画**：整窗淡出会让外壳跟着闪，内容区位移则是另一套「预设效果」；
 *   转场只需要「旧状态还在」这一件事，把共享元素喂给 `group(*)` 就够了。
 */

import { checkViewTransitionNames } from './names';

/**
 * 转场种类，写进 `<html data-vt>`，样式层据此选动画轨道（见 view-transitions.css）：
 * - `route`：路由切页 —— 页面本体瞬时切换（只为共享元素提供转场）
 * - `theme`：主题切换 —— 整窗双快照交叉淡出
 *
 * 播放页开合**不在**这里：它是两块 live 板子的交叉淡变（见 `features/player`），
 * 一个快照都不用 —— 快照做不到「一块板子降、另一块升」。
 */
export type ViewTransitionKind = 'route' | 'theme';

export interface ViewTransitionOptions {
  kind?: ViewTransitionKind;
  /**
   * 转场结束时调用一次（含「没做转场」的退化路径）。
   * 用于把原本挂在退出动画上的收尾动作（如 `playerPageStore` 的 afterClose）
   * 挂到真正的转场生命周期上，而不是自己猜一个 setTimeout。
   */
  onFinish?: () => void;
}

/**
 * `Document.startViewTransition` 在 lib.dom 里的可用性随 TS 版本变化，
 * 这里只声明确实用到的那一部分，不去赌 lib 版本。
 */
type ViewTransitionDocument = Document & {
  startViewTransition?: (
    update: () => void,
  ) => { finished?: Promise<unknown> } | undefined;
};

const REDUCE_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * 标记这一场转场的种类，写 `<html data-vt>`（样式层据此分流，见 view-transitions.css）。
 *
 * 由发起方在 `startViewTransition` **之前**写：转场一旦开始，伪元素动画就按当时的
 * 属性选轨道。放在 `<html>` 上而不是某个组件里 —— 它是文档级的编排标志，
 * 不属于任何一段 JSX 的渲染输出。
 */
export const setViewTransitionKind = (kind: ViewTransitionKind): void => {
  document.documentElement.dataset.vt = kind;
};

/** 浏览器是否支持同文档视图转场（WebView2 / Chromium 111+ 支持）。 */
export const supportsViewTransition = (): boolean =>
  typeof (document as ViewTransitionDocument).startViewTransition ===
  'function';

/** 系统「减少动态效果」。 */
export const prefersReducedMotion = (): boolean =>
  window.matchMedia(REDUCE_MOTION_QUERY).matches;

/**
 * 转场是否可用（支持 + 用户没要求减动效）。
 * 不可用时 `runViewTransition` 退化为**直接执行** update —— 瞬时切换本身就是打平后
 * 最便宜的做法，不需要额外补偿动画。
 */
export const canRunViewTransition = (): boolean =>
  supportsViewTransition() && !prefersReducedMotion();

/** 同一时刻只允许一场转场：正在跑时新请求退化为瞬时切换，不排队、不打断。 */
let inFlight = false;

/**
 * 执行一次视图转场。
 *
 * `update` **必须把所有 DOM 变更做完**（React 侧用 `flushSync` 包住 state 变更），
 * 转场会在它返回后的下一帧取新快照。返回值表示这一次是否真的做了转场。
 *
 * 为什么不排队：一场转场只有几百毫秒，排队会累积到用户已经看不出因果关系；
 * 而打断（`skipTransition`）在 keepalive 那条路径上没人负责收尾。
 * 退化成瞬时切换最不容易出错。
 */
export const runViewTransition = (
  update: () => void,
  { kind = 'route', onFinish }: ViewTransitionOptions = {},
): boolean => {
  if (!canRunViewTransition() || inFlight) {
    update();
    onFinish?.();
    return false;
  }

  const doc = document as ViewTransitionDocument;
  setViewTransitionKind(kind);
  checkViewTransitionNames();

  inFlight = true;
  const transition = doc.startViewTransition?.(update);
  const finish = () => {
    inFlight = false;
    onFinish?.();
  };

  // 连点 / 被下一场打断时 finished 会 reject（AbortError）：吞掉，否则控台多一条
  // 未处理的 promise 拒绝。成功与失败都算「结束」，onFinish 只跑一次。
  if (transition?.finished) transition.finished.then(finish, finish);
  else finish();

  return true;
};

export {
  checkViewTransitionNames,
  findNameCollisions,
  vtName,
  type ViewTransitionNameCollision,
  type VtNameScope,
} from './names';
