/**
 * IPC / 前端错误的统一展示与排查出口。
 *
 * Rust 侧的错误契约是 `{ kind, message, detail? }`：
 * - `message`：面向用户，短、可直接 toast
 * - `detail`：面向开发者（reqwest 根因链 / 原始 code / 期望的 DTO），**不进 UI**
 *
 * 因此「展示」与「排查」分开：`errorMessage` 给人看，`errorDetail` 给 devtools，
 * `reportError` 一次做完两件事并返回 message 供 toast 使用。
 */

/** 取错误中的 `message`（面向用户）。Tauri `invoke` 的 reject 可能是 Error、`{kind,message}` 或字符串。 */
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

/** 取错误中的 `detail`（面向开发者，Rust 侧根因链）；没有则 null。 */
export function errorDetail(e: unknown): string | null {
  if (typeof e === 'object' && e !== null && 'detail' in e) {
    const { detail } = e as { detail?: unknown };
    if (typeof detail === 'string' && detail) return detail;
  }
  return null;
}

/**
 * 打点 + 取文案：`message` 与 `detail` 一起进 devtools 控制台，返回 `message` 供调用方 toast。
 * 统一出口，避免各处 catch 只留一句 message 而把根因丢掉。
 */
export function reportError(
  scope: string,
  e: unknown,
  fallback = '操作失败，请重试',
): string {
  const message = errorMessage(e, fallback);
  const detail = errorDetail(e);
  if (detail) {
    console.error(`[${scope}] ${message}\n${detail}`);
  } else {
    console.error(`[${scope}]`, e);
  }
  return message;
}
