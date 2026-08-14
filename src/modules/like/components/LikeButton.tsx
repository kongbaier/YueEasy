import type { Track } from "@/shared/types/player";
import { useLikeAction } from "@/modules/like/hooks/useLikeAction";
import { cn } from "@/shared/utils/cn";
import { Button } from "@/shared/ui/button";
import { Heart } from "lucide-react";

export const LikeButton = ({
  track,
  className,
  size = "icon",
  iconSize = 4.5,
}: {
  track: Track;
  className?: string;
  size?: "icon" | "icon-sm" | "icon-lg";
  iconSize?: number;
}) => {
  const { handleLike, isLiked } = useLikeAction();

  const liked = isLiked(track.id);

  return (
    <Button
      className={cn(liked && "text-[#ef4444]", className)}
      onClick={() => handleLike(track)}
      size={size}
      title={liked ? "取消收藏" : "收藏"}
      variant="svg"
    >
      <Heart className={`size-${iconSize}`} fill={liked ? "#ef4444" : "none"} />
    </Button>
  );
};
