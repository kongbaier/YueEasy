import type { ComponentProps } from 'react';
import SimpleBar from 'simplebar-react';
import { cn } from '@/shared/utils/cn';

/**
 * 统一滚动容器（SimpleBar）。
 *
 * 需要滚动的地方一律用它，不要再写 `overflow-y-auto`：原生滚动条样式各平台不一，
 * SimpleBar 用悬浮细条（绝对定位，不占布局），全应用观感一致。
 *
 * 用法约定：
 * - 高度必须由外部给定（`h-full` / `flex-1 min-h-0`），否则容器会随内容撑开而不滚动；
 *   `min-h-0` 已内置，flex 子项不必再写。
 * - **滚动所有权在页面**：路由页自己给出滚动根（常规 `<ScrollArea className="h-full">`），
 *   布局层不代管滚动（见 AGENTS.md §8）。
 * - 内边距写在 ScrollArea 上，不要写在子元素上：SimpleBar 会把 padding 搬到内容层、
 *   给滚动视口加反向负边距，这样滚动条贴着容器真正的边缘（写子元素上内容会压到滚动条下面）。
 *   这条依赖 `index.css` 里 `.simplebar-content` 的 `height: 100% + min-height: fit-content`：
 *   只有 `height: 100%` 时内容会溢出内容盒，`pb` 不计入 scrollHeight（底部留白消失）。
 */
export const ScrollArea = ({
  className,
  ...props
}: ComponentProps<typeof SimpleBar>) => (
  <SimpleBar className={cn('min-h-0', className)} {...props} />
);
