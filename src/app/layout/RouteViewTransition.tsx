import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  checkViewTransitionNames,
  setViewTransitionKind,
} from '@/shared/lib/viewTransition';

/**
 * 路由转场的「发起前收尾」：标记种类 + 开发期断言。
 *
 * 转场本身由 `KeepAliveRouteOutlet` 的 `viewTransition` 发起，这里只负责在它之前：
 * - 写 `<html data-vt="route">`：否则紧接着主题切换之后的一次切页会沿用
 *   `data-vt="theme"`，整窗做 300ms 交叉淡出（见 assets/css/view-transitions.css）；
 * - 扫一遍「同名并存」：浏览器遇到会静默 abort 整场转场，开发期给一条警告。
 *
 * 为什么必须是 leaf、而且排在 outlet **前面**：
 * - outlet 在**子节点**的 layout effect 里调 `startViewTransition`，React 的 layout
 *   effect 按挂载序执行（兄弟先于后代）——排前面就一定在转场建立之前写完标记。
 * - 订阅 `useLocation` 会让组件每次导航重渲染；放在 `AppLayout` 里会带着整棵外壳
 *   （播放栏等）一起重渲染，做成 leaf 就只重渲染它自己（返回 null）。
 */
export const RouteViewTransition = () => {
  const { key } = useLocation();

  useLayoutEffect(() => {
    setViewTransitionKind('route');
    checkViewTransitionNames();
  }, [key]);

  return null;
};
