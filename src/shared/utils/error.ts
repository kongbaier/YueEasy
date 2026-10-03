/**
 * 任意抛出物 → 可展示文案。
 *
 * 优先取 `message`：Tauri `invoke` 的 reject 既可能是 `Error`（前端内部错误），
 * 也可能是 Rust `NcmApiError` 序列化后的 `{ kind, message }` 普通对象；
 * 网络层（`netease/error.rs`）已把可读文案放进 `message`，前端只负责展示，不判业务 code。
 */
export function errorMessage(
  e: unknown,
  fallback = '操作失败，请重试',
): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e) return e;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const { message } = e as { message?: unknown };
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}
