import type { Track } from '@/shared/types/player';
import { useLikeAction } from '@/modules/like/hooks/useLikeAction';
import { cn } from '@/shared/utils/cn';
import { Button } from '@/shared/ui/button';
import { Heart } from 'lucide-react';

export const LikeButton = ({
  track,
  className,
  size = 'icon',
  iconSize = 4.5,
}: {
  track: Track | null;
  className?: string;
  size?: 'icon' | 'icon-sm' | 'icon-lg';
  iconSize?: number;
}) => {
  const { like, isLiked } = useLikeAction();

  const liked = track && isLiked(track.id);
  const handleLike = () => {
    if (!track) return;
    like(track);
  };

  return (
    <Button
      className={cn(liked && 'text-[#ef4444]', className)}
      onClick={handleLike}
      size={size}
      title={liked ? '取消收藏' : '收藏'}
      variant="svg"
    >
      <Heart className={`size-${iconSize}`} fill={liked ? '#ef4444' : 'none'} />
    </Button>
  );
};
