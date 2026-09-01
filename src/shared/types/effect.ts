// Windows 窗口材质效果（领域类型 + 伴随枚举常量）。
//
// wire 值对齐 Tauri `@tauri-apps/api/window` 的 Effect 枚举（字符串字面量），
// 因此 infra（src/tauri/effect.ts）可原值透传进 `window.setEffects`（仅需类型收窄）。
// 各层（types/constants/ui）均可引用 —— 不再反向依赖 infra。

/** Windows 材质效果枚举（值 = Tauri wire 值）。 */
export const Effect = {
  Mica: 'mica',
  Tabbed: 'tabbed',
  Acrylic: 'acrylic',
} as const;

/** Effect 的联合类型（与常量同构）。 */
export type Effect = (typeof Effect)[keyof typeof Effect];

/** 应用支持的材质列表（对齐旧 WINDOWS_EFFECTS 顺序）。 */
export const WINDOWS_EFFECTS = [
  Effect.Mica,
  Effect.Tabbed,
  Effect.Acrylic,
] as const;

/** 可选材质效果的 wire 类型。 */
export type WindowsEffect = (typeof WINDOWS_EFFECTS)[number];
