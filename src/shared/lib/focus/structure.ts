/**
 * 区域条目的结构裁剪（纯函数，无 DOM 依赖，可单测）。
 *
 * 规则：**区域自身与它的结构包裹层永远不是条目。**
 *
 * 一个可聚焦元素如果「里面还包着别的条目」，它就是容器而不是条目
 * （滚动容器、组件库的外层 wrapper、`role="region"` 之类的整块可聚焦壳），
 * 必须从条目列表里剔除 —— 否则 Tab 会停在整块区域上，而不是第一个真实控件。
 *
 * 例外：显式钉住的条目（`data-focus-item`）即使包着子条目也算条目 ——
 * 「整行/整卡可点，行内还有红心 / 专辑链接 / 删除按钮」就是这种。
 */

export interface PruneContainersOptions<T> {
  /** 向上取一层容器（返回 null 表示已到区域边界）。 */
  parentOf: (item: T) => T | null;
  /** 显式钉住的条目：不参与包裹层剔除。 */
  isPinned: (item: T) => boolean;
}

export const pruneContainers = <T>(
  items: T[],
  { parentOf, isPinned }: PruneContainersOptions<T>,
): T[] => {
  const candidates = new Set<T>(items);
  const wrappers = new Set<T>();

  for (const item of items) {
    let parent = parentOf(item);
    while (parent) {
      if (candidates.has(parent) && !isPinned(parent)) wrappers.add(parent);
      parent = parentOf(parent);
    }
  }

  return wrappers.size === 0
    ? items
    : items.filter((item) => !wrappers.has(item));
};
