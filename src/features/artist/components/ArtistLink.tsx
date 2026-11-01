import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';
import type { Artist } from '@/shared/types/uiModels';

interface ArtistLinkProps {
  artist: Artist;
  className?: string;
  /** 跳转前的副作用（如关闭全屏播放页覆盖层）。 */
  beforeOpen?: () => void;
  /** 列表行内使用：阻止双击播歌 / 行点击冒泡。 */
  stopPropagation?: boolean;
}

/**
 * 歌手名链接（全站唯一的「进入歌手页」入口）。
 *
 * 歌手实体一定带 id（接口与队列快照都保证），所以无条件渲染成 `<Link>`，
 * 不做「有没有 id」的判定——那层判定只会让 UI 出现「有时能点、有时不能点」的分叉。
 */
export const ArtistLink = ({
  artist,
  className,
  beforeOpen,
  stopPropagation,
}: ArtistLinkProps) => {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (stopPropagation) e.stopPropagation();
    beforeOpen?.();
  };

  return (
    <Link
      className={cn('hover:text-primary hover:underline', className)}
      onClick={handleClick}
      onDoubleClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      to={`/artist/${artist.id}`}
    >
      {artist.name}
    </Link>
  );
};
