// 桌面歌词的显示候选值（UI 层知识，不进 shared/constants）。

/** 当前句字号候选（px）；上下一句按 `SIDE_LINE_SCALE` 缩放。 */
export const DESKTOP_LYRICS_FONT_SIZES = [28, 36, 44, 52] as const;

/** 字号选项的展示文案（与上面的候选顺序一一对应）。 */
export const DESKTOP_LYRICS_FONT_SIZE_LABELS = ['小', '中', '大', '特大'] as const;

/** 上下一句的不透明度候选；`0` = 不显示上下一句。 */
export const DESKTOP_LYRICS_SIDE_OPACITIES = [0, 0.35, 0.55, 0.75] as const;

/** 不透明度选项的展示文案。 */
export const DESKTOP_LYRICS_SIDE_OPACITY_LABELS = [
  '隐藏',
  '淡',
  '标准',
  '明显',
] as const;

/** 上下一句相对当前句的字号比例。 */
export const SIDE_LINE_SCALE = 0.6;

/** 翻译行相对当前句的字号比例。 */
export const TRANSLATION_SCALE = 0.42;

/**
 * 行高倍数（当前句 / 上下一句 / 翻译共用）。
 * 窗口高度是按自然行高叠出来的，所以三处必须一致 —— 改这里就能整体变松 / 变紧。
 */
export const LYRIC_LINE_HEIGHT = 1.35;

// 歌词区域宽度上限 = 窗口宽度，定在 `tauri.conf.json`（`width` = `maxWidth`），
// 不在 JS 再抄一份：Web 只负责「按现有宽度排版 + 量高度」。
// 超宽的当前句由视口内横向滚动展示（不换行、不截断），滚动位置跟随播放进度。

/** 解锁态：鼠标进入后到工具栏/底色的显形延迟（避免划过就闪）。 */
export const CHROME_SHOW_DELAY_MS = 120;

/**
 * 解锁态：鼠标离开后延迟多久才收起。
 *
 * 不能立即收起：歌词换行 / 字级 span 重建会把光标下的元素移除，Chromium 会补发一次
 * 「伪 mouseleave」，立即收起就会看到底色和功能栏莫名闪一下。
 */
export const CHROME_HIDE_DELAY_MS = 140;

/**
 * 「伪 mouseleave」的判据窗口：收到 leave 时，如果最后一次真实 mousemove 已经过去这么久，
 * 就认定这不是离开（指针根本没法在不移动的情况下移出窗口）。
 *
 * 伪 leave 的事件坐标不可靠（Chromium 补发时可能给 (0,0) / 陈旧坐标），所以不能靠坐标判断。
 */
export const LEAVE_MOVE_WINDOW_MS = 200;

/**
 * 桌面歌词窗口的配色（唯一调整入口；组件里只引用这里的值）。
 *
 * 为什么不跟随主题语义色（`text-foreground` / `text-muted-foreground`）：
 * 这个窗口浮在任意壁纸上，而且**不跑 `useThemeSync`**（没有 `.dark` 类），
 * 语义色会取浅色主题那一套（深色字），在深色壁纸上直接看不见。
 * 所以一律「白色 + 透明度」自证对比度，只有已唱字用主色 `--primary`（= 系统强调色 `--brand`）。
 *
 * 其余 chrome（功能栏 / 设置面板 / 上下一句 / 翻译）用的是 Tailwind 的白色透明度工具类，
 * 位置见各组件头部注释：
 *   - 功能栏按钮        components/DesktopLyricsToolbar.tsx  `TOOLBAR_BUTTON`（text-white/80）
 *   - 设置面板          components/DesktopLyricsSettingsPanel.tsx（bg-black/75、ring-white/15…）
 *   - 上下一句 / 翻译   components/DesktopLyricsWindow.tsx（透明度来自设置项 sideLineOpacity）
 */
export const LYRICS_COLOR = {
  /** 已唱字：主色（theme.css 的 `--brand`，随系统强调色变化） */
  sung: 'var(--primary)',
  /** 未唱字：白 82% */
  future: 'rgba(255, 255, 255, 0.82)',
  /**
   * 正在唱的那个字（逐字歌词 yrc 的渐变字）的投影。
   * 渐变文字（`bg-clip-text` + `text-transparent`）不能用 `text-shadow`
   * （文字本身是透明的，阴影会从字里透出来），只能用 `drop-shadow` 作用于已绘制结果。
   * 它只挂在那一行上（不是整窗容器上）：整窗的 filter 会多出一块全屏渲染面，
   * 在透明窗口里容易引发层提升/降级导致的整体变淡。
   * 普通歌词（lrc）是实色字，一律用下面的 `textShadow`。
   */
  shadow: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.65))',
  /** 普通文本（上下一句 / 翻译 / 非逐字的当前句）的投影：不是渐变字，用 text-shadow 更便宜也更稳 */
  textShadow: '0 1px 4px rgba(0, 0, 0, 0.75)',
  /** 可操作时窗口底色的目标不透明度（底色层是纯黑 + opacity，见 DesktopLyricsWindow） */
  overlayOpacity: 0.45,
} as const;

/** 上下一句的文字颜色：白色，透明度来自设置项 `sideLineOpacity`。 */
export function sideLineColor(opacity: number): string {
  return `rgba(255, 255, 255, ${opacity})`;
}
