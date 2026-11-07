import { Lock, MicVocal, Unlock } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu';
import { cn } from '@/shared/utils/cn';
import { useDesktopLyrics } from '../hooks/useDesktopLyrics';

/**
 * 桌面歌词开关（PlayerBar）。
 *
 * 左键：开 / 关；右键：锁定（鼠标穿透）与解锁 ——
 * 锁定后桌面歌词窗口整体点不到，所以解锁入口必须留在这里。
 */
export const LyricsToggle = () => {
  const { enabled, locked, toggle, setLocked } = useDesktopLyrics();

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <Button
            aria-label={enabled ? '关闭桌面歌词' : '开启桌面歌词'}
            className={cn(enabled ? 'text-primary' : 'hover:text-primary')}
            onClick={toggle}
            size="icon"
            variant={enabled ? 'secondary' : 'ghost'}
          >
            <MicVocal className="size-4.5" />
          </Button>
        }
      />
      <ContextMenuContent>
        <ContextMenuItem disabled={!enabled} onClick={() => setLocked(!locked)}>
          {locked ? <Unlock /> : <Lock />}
          {locked ? '解锁桌面歌词' : '锁定桌面歌词'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={toggle}>
          {enabled ? '关闭桌面歌词' : '开启桌面歌词'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
