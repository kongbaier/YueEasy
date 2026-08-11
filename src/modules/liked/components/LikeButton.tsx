import type { Track } from "@/core";
import { useLikeAction } from "@/shared/hooks/useLikeAction";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Heart } from "lucide-react";

export const LikeButton = ({
  track,
  className,
}: {
  track: Track;
  className?: string;
}) => {
  const { handleLike, isLiked } = useLikeAction();

  const liked = isLiked(track.id);

  return (
    <Button
      className={cn("", liked && "text-[#ef4444]", className)}
      onClick={() => handleLike(track.id, track.name)}
      size="icon"
      variant="svg"
    >
      <Heart className="size-4.5" fill={liked ? "#ef4444" : "none"} />
    </Button>
  );
};
