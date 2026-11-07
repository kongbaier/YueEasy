import type { DesktopLyricLine } from '@/shared/types/desktopLyrics';
import { cn } from '@/shared/utils/cn';
import { clamp01 } from '@/shared/utils/number';
import { LYRICS_COLOR } from '../constants';

function fillStyle(progress: number): React.CSSProperties {
  const percent = clamp01(progress) * 100;
  return {
    backgroundImage: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${percent}%, ${LYRICS_COLOR.future} ${percent}%, ${LYRICS_COLOR.future} 100%)`,
  };
}

interface DesktopLyricTextProps {
  line: DesktopLyricLine;
  /**
   * 当前播放进度（ms）。传 `null` 表示这一行还没开始唱（上一句 / 下一句的预览）：
   * 整行按未唱处理，不做填充。
   */
  positionMs: number | null;
  className?: string;
  /** 字号 / 行高等排版（由窗口按设置注入） */
  style?: React.CSSProperties;
}

/**
 * 一句桌面歌词。
 *
 * - 逐字歌词（yrc）：按字填充 —— 已唱 = 主色，正在唱 = 主色 → 白色渐变，未唱 = 半透明白；
 * - 普通歌词（lrc）：没有字级时间，就**不硬造逐行填充**（那只是个假进度，跟着句子长短拖得很快 / 很慢），
 *   整句直接用「已唱」色（主色）。
 */
export const DesktopLyricText = ({
  line,
  positionMs,
  className,
  style,
}: DesktopLyricTextProps) => {
  const words = line.words ?? [];
  const elapsed = positionMs === null ? -1 : positionMs - line.startMs;

  if (words.length > 0) {
    return (
      <p
        className={cn('font-bold', className)}
        // 整行一个 drop-shadow（含渐变字与实色字），不在整窗容器上挂 filter
        style={{ filter: LYRICS_COLOR.shadow, ...style }}
      >
        {words.map((word) => {
          const wordElapsed = elapsed - word.startMs;
          const text = word.text;
          // 一个字在句内位置唯一：用「起始时间 + 文本」当 key（不用数组下标）
          const key = `${word.startMs}-${text}`;

          if (positionMs === null || wordElapsed < 0) {
            return (
              <span key={key} style={{ color: LYRICS_COLOR.future }}>
                {text}
              </span>
            );
          }
          if (word.durationMs <= 0 || wordElapsed >= word.durationMs) {
            return (
              <span key={key} style={{ color: LYRICS_COLOR.sung }}>
                {text}
              </span>
            );
          }
          return (
            <span
              key={key}
              className="bg-clip-text text-transparent"
              style={fillStyle(wordElapsed / word.durationMs)}
            >
              {text}
            </span>
          );
        })}
      </p>
    );
  }

  // 普通歌词：不造假进度，整句一个「已唱」色。
  // 同时这里用 `text-shadow` 而不是 `filter: drop-shadow`：实色字不需要 drop-shadow，
  // 后者会给整行多开一块渲染面。
  return (
    <p
      className={cn('font-bold', className)}
      style={{
        ...style,
        color: LYRICS_COLOR.sung,
        textShadow: LYRICS_COLOR.textShadow,
      }}
    >
      {line.text}
    </p>
  );
};
