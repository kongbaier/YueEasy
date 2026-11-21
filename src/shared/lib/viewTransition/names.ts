/**
 * 共享元素的名字（`view-transition-name`）—— **纯声明式，不碰 DOM**。
 *
 * 名字是跨页 morph 的唯一契约：两页各挂**同名**元素，浏览器就把旧页的截图从旧位置
 * 搬到新位置（尺寸 / 位置 / 圆角一起插值）。名字只出现在 JSX 的 `style` 里：
 *
 * ```tsx
 * <Cover style={{ viewTransitionName: vtName('playlist', playlist.id) }} … />
 * ```
 *
 * 为什么不做「注册表仲裁」（谁该拿到这个名字）这种命令式方案：
 * - `view-transition-name` 是**呈现提示**，不是数据。走 `style` 与 React 的渲染输出
 *   完全同步；一旦改成 ref 回调里 `el.style.viewTransitionName = …`，React 的 style
 *   diff 不再拥有这个属性，出现「谁在什么时候改它」的第二套真相。
 * - 更要命的是**仲裁时机**：转场有两张快照（旧状态 = 换页前、新状态 = 换页后），
 *   谁该持名字在两张快照里正好相反。任何在「render / 挂载 / 卸载」时刻做的仲裁都会
 *   落在两张快照之间，把名字从正在离场的元素或正在进场的元素上摘掉 —— 结果是 morph 消失。
 *   而 `KeepAlive` 保证**同一时刻只有一页的 DOM 在文档里**（新页先渲染进游离节点，
 *   换页时才 append，旧页同时 remove），所以跨页同名天然不会撞。
 *
 * 于是唯一真正的风险收缩成「**同一张快照里**出现两个同名元素」（同一页里的重复卡片、
 * 播放栏缩略图与播放页大封面这类「同一个东西的两个分身」）。浏览器遇到它就是**静默
 * abort 整场转场**（页面直接硬切、控制台零输出），所以用 `checkViewTransitionNames()`
 * 在每次转场前做一次开发期断言，把这种坑从「玄学不生效」变成一条明确的警告。
 */

export type VtNameScope =
  | 'playlist'
  | 'album'
  | 'artist'
  | 'user'
  | 'track'
  | 'player';

const ILLEGAL_IDENT_CHARS = /[^a-zA-Z0-9_-]/g;

/**
 * `vtName('playlist', 24381616)` → `vt-playlist-24381616`。
 *
 * 必须带 scope 前缀：`view-transition-name` 是 CSS 自定义标识符，**不能以数字开头**
 * （歌单 / 曲目 id 是纯数字），非法字符也一律换成下划线。
 */
export const vtName = (scope: VtNameScope, id: string | number): string =>
  `vt-${scope}-${String(id).replace(ILLEGAL_IDENT_CHARS, '_')}`;

/** 一张快照里同名 ≥2 次的元素（开发期断言用，`elements` 只取在文档里的）。 */
export interface ViewTransitionNameCollision {
  name: string;
  elements: HTMLElement[];
}

/**
 * 纯函数：从「候选元素」里找出**同一张快照里**会撞名的那些。
 *
 * 只算 `isConnected` 的元素：游离节点的 `view-transition-name` 不参与快照
 * （KeepAlive 缓存页正好都躺在游离节点里）。
 */
export const findNameCollisions = (
  elements: Iterable<HTMLElement>,
): ViewTransitionNameCollision[] => {
  const byName = new Map<string, HTMLElement[]>();

  for (const el of elements) {
    const name = el.style.viewTransitionName;
    if (!name || name === 'none' || !el.isConnected) continue;
    const list = byName.get(name);
    if (list) list.push(el);
    else byName.set(name, [el]);
  }

  const collisions: ViewTransitionNameCollision[] = [];
  for (const [name, list] of byName) {
    if (list.length > 1) collisions.push({ name, elements: list });
  }
  return collisions;
};

/**
 * 开发期断言：转场开始前扫一遍文档，同名的多个在册元素会被打出来。
 *
 * 为什么要用「内联样式子串」找候选：`view-transition-name` 只能写在 `style` 里
 * （见文件头），所以 `[style*="view-transition-name"]` 就是候选全集 —— 连手写的也能抓到。
 * 生产构建里整段被 `import.meta.env.DEV` 掉。
 */
export const checkViewTransitionNames = (): void => {
  if (!import.meta.env.DEV) return;

  const candidates = document.querySelectorAll<HTMLElement>(
    '[style*="view-transition-name"]',
  );
  for (const { name, elements } of findNameCollisions(candidates)) {
    console.warn(
      `[view-transition] 同一张快照里有 ${elements.length} 个元素共用 "${name}"，` +
        '整场转场会被浏览器静默丢弃。同一个东西的多个分身只能有一个挂名字（见 AGENTS.md §13）。',
      elements,
    );
  }
};
