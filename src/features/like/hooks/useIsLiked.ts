import { useLikeStore } from '@/features/like/stores/like';

/**
 * 单曲点赞态：**按 id 细粒度订阅**（选择器返回 boolean）。
 *
 * 不要写成「订阅整个 `likedIds`，再在渲染里 `likedIds.has(id)`」：zustand 只比较选择器
 * 的返回值，订阅整张 Set 意味着任意一次点赞都会让所有订阅者重渲染 —— 千行歌单就是
 * 上千行白跑一遍（每行还带 ContextMenu / 封面 / 子组件）。
 *
 * `id` 允许为空：播放栏在没有当前曲时传 `null`，此时恒为 false。
 */
export function useIsLiked(id: number | null | undefined): boolean {
  return useLikeStore((s) => (id == null ? false : s.likedIds.has(id)));
}
