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
 * 歌手实体带 id 时渲染成 `<Link>`；id 缺失（=0）时退化成纯文本、不可点：
 * 这类条目来自没有 id 的数据源（云盘扁平字段、旧本地播放记录的 `artist` 名字串），
 * 拿 0 去拼 `/artist/0` 只会跳到一个不存在的页面。
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

  if (artist.id <= 0) {
    return <span className={className}>{artist.name}</span>;
  }

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
