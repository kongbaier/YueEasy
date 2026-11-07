import { cn } from '@/shared/utils/cn';
import type { DesktopLyricsLayoutPatch } from '@/shared/types/desktopLyrics';
import type { DesktopLyricsSettings } from '@/shared/types/settings';
import {
  DESKTOP_LYRICS_FONT_SIZES,
  DESKTOP_LYRICS_FONT_SIZE_LABELS,
  DESKTOP_LYRICS_SIDE_OPACITIES,
  DESKTOP_LYRICS_SIDE_OPACITY_LABELS,
} from '../constants';

interface DesktopLyricsSettingsPanelProps {
  settings: DesktopLyricsSettings;
  onChange: (patch: DesktopLyricsLayoutPatch) => void;
}

/**
 * 桌面歌词排版设置（窗口内浮层）。
 *
 * 改动只发 `update-layout` 请求，由主窗口落 settings 再回推——
 * 本窗口不持可写状态，settings 的唯一真相始终在主窗口。
 */
export const DesktopLyricsSettingsPanel = ({
  settings,
  onChange,
}: DesktopLyricsSettingsPanelProps) => (
  <div className="pointer-events-auto w-[330px] rounded-xl bg-black/75 p-3 ring-1 ring-white/15">
    <Row label="字号">
      <Segmented
        onChange={(index) => onChange({ fontSize: DESKTOP_LYRICS_FONT_SIZES[index] })}
        options={DESKTOP_LYRICS_FONT_SIZE_LABELS.map((label) => ({ label }))}
        value={DESKTOP_LYRICS_FONT_SIZES.indexOf(
          settings.fontSize as (typeof DESKTOP_LYRICS_FONT_SIZES)[number],
        )}
      />
    </Row>

    <Row label="上下一句">
      <Segmented
        onChange={(index) =>
          onChange({ sideLineOpacity: DESKTOP_LYRICS_SIDE_OPACITIES[index] })
        }
        options={DESKTOP_LYRICS_SIDE_OPACITY_LABELS.map((label) => ({ label }))}
        value={DESKTOP_LYRICS_SIDE_OPACITIES.indexOf(
          settings.sideLineOpacity as (typeof DESKTOP_LYRICS_SIDE_OPACITIES)[number],
        )}
      />
    </Row>

    <Row label="翻译">
      <Segmented
        onChange={(index) => onChange({ showTranslation: index === 0 })}
        options={[{ label: '显示' }, { label: '隐藏' }]}
        value={settings.showTranslation ? 0 : 1}
      />
    </Row>
  </div>
);

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-3 py-1">
    <span className="text-xs text-white/60">{label}</span>
    {children}
  </div>
);

interface SegmentedProps {
  options: { label: string }[];
  /** 当前选中项的下标（-1 = 不在候选里，全部不高亮） */
  value: number;
  onChange: (index: number) => void;
}

const Segmented = ({ options, value, onChange }: SegmentedProps) => (
  <div className="flex items-center gap-0.5 rounded-lg bg-white/5 p-0.5">
    {options.map((option, index) => (
      <button
        className={cn(
          'rounded-md px-2 py-0.5 text-xs transition-colors',
          index === value
            ? 'bg-white/25 text-white'
            : 'text-white/60 hover:bg-white/10 hover:text-white',
        )}
        key={option.label}
        onClick={() => onChange(index)}
        type="button"
      >
        {option.label}
      </button>
    ))}
  </div>
);
