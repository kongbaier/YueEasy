import type { RepeatMode } from '@/shared/types/player';
import type { AudioQuality, PlayerSettings } from '../types/settings';

/** 终止策略循环：off → all → one → off。仅当 content_source == queue 时生效。 */
export const NEXT_REPEAT: Record<RepeatMode, RepeatMode> = {
  off: 'all',
  all: 'one',
  one: 'off',
};

export const DEFAULTS_PLAYER: PlayerSettings = {
  volume: 0.5,
  isMuted: false,
  playbackRate: 1,
  savePlaybackHistory: true,
  // 2GB：320kbps 约 200 首 / 128kbps 约 500 首，兼顾「够用」与「不抢磁盘」
  audioCacheLimitMB: 2048,
  // 320k mp3：免登录 / 非 VIP 也都拿得到，是无损被降级后的同一档（不会白请求）
  audioQuality: 'exhigh',
  desktopLyrics: {
    enabled: false,
    locked: false,
    // 36px ≈ 原 text-4xl；上下一句默认 0.6 倍 + 55% 白（旧版是 text-lg + 30% 白，偏小偏淡）
    fontSize: 36,
    sideLineOpacity: 0.55,
    showTranslation: true,
  },
};

/** 音频缓存上限候选值（MB）：`0` = 关闭。 */
export const AUDIO_CACHE_LIMIT_OPTIONS = [
  0, 512, 1024, 2048, 4096, 8192,
] as const;

/**
 * 音质档位候选（`level` 取值）+ 展示文案。
 *
 * 顺序即 UI 顺序（从低到高）。`description` 里的「需 VIP / SVIP」只是给用户的预期提示，
 * **不做前置拦截**：无权限时服务端会降级成当前账号能给的最高档，播放不会失败。
 */
export const AUDIO_QUALITY_OPTIONS: {
  value: AudioQuality;
  label: string;
  description: string;
}[] = [
  { value: 'standard', label: '标准', description: '128 kbps MP3' },
  { value: 'higher', label: '较高', description: '192 kbps MP3' },
  { value: 'exhigh', label: '极高', description: '320 kbps MP3' },
  { value: 'lossless', label: '无损', description: 'FLAC · 黑胶 VIP' },
  { value: 'hires', label: 'Hi-Res', description: '24bit FLAC · 黑胶 VIP' },
  { value: 'jymaster', label: '超清母带', description: '24bit 母带 · SVIP' },
  { value: 'sky', label: '沉浸环绕', description: '空间音频 · SVIP' },
];

/** `level` → 展示名（服务端可能回非请求档位，也可能是未知值）。 */
const AUDIO_QUALITY_LABELS: Record<string, string> = Object.fromEntries(
  AUDIO_QUALITY_OPTIONS.map(({ value, label }) => [value, label]),
);

/** 档位展示名；未知档位原样返回，缺省返回空串（调用方据此不渲染徽标）。 */
export function audioQualityLabel(level?: string | null): string {
  if (!level) return '';
  return AUDIO_QUALITY_LABELS[level] ?? level;
}
