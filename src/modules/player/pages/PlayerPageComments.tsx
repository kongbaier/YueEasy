import { Heart, MessageSquare } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { VirtuosoScroller } from "@/shared/ui/virtuoso";
import { formatCount } from "@/shared/utils/format";
import { toast } from "@/shared/lib/toast";
import { cn } from "@/shared/lib/utils";
import { ncm } from "@/tauri/ncm";
import type { NcmComment } from "@/tauri/ncm/types/comment.response";
import { useQuery } from "@tanstack/react-query";

function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}个月前`;
  return `${Math.floor(months / 12)}年前`;
}

interface CommentItemProps {
  comment: NcmComment;
  isHot?: boolean;
}

const CommentItem = ({ comment, isHot }: CommentItemProps) => {
  return (
    <div className="group flex gap-3 px-2 py-3 w-full text-left rounded-md">
      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
        {comment.user.avatarUrl ? (
          <img
            alt={comment.user.nickname}
            className="object-cover"
            src={comment.user.avatarUrl}
          />
        ) : (
          <MessageSquare className="size-3.5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground truncate max-w-30">
            {comment.user.nickname}
          </span>
          {isHot && (
            <span className="text-[10px] text-red-500 border border-red-500/30 rounded px-1 leading-none py-0.5">
              热评
            </span>
          )}
        </div>

        <p className="text-sm mt-1 leading-relaxed wrap-break-word">
          {comment.content}
        </p>

        {comment.beReplied && comment.beReplied.length > 0 && (
          <div className="mt-1.5 p-2 rounded bg-surface-hover text-xs text-muted-foreground">
            {comment.beReplied.map((reply) => (
              <span key={reply.beRepliedCommentId}>
                <span className="text-foreground/70">
                  @{reply.user.nickname}
                </span>
                ：{reply.content}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] text-muted-foreground/60">
            {relativeTime(comment.time)}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
            <Heart className="size-2.5" />
            {comment.likedCount > 0 ? formatCount(comment.likedCount) : ""}
          </span>
        </div>
      </div>
    </div>
  );
};

export const PlayerPageComments = ({ songId }: { songId: number }) => {
  const { isLoading, data } = useQuery({
    queryKey: ["comments", songId],
    queryFn: () =>
      ncm
        .commentMusic(songId, 40, 0)
        .then((data) => {
          return data;
        })
        .catch(() => {
          toast.error("加载评论失败");
        }),
  });

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-xs text-muted-foreground">加载中...</p>
      </div>
    );
  }

  const allComments = [...(data?.hotComments ?? []), ...(data?.comments ?? [])];
  const hotCount = data?.hotComments?.length ?? 0;
  const total = data?.total ?? 0;

  return (
    <div className="h-full w-full flex flex-col">
      <header className="flex items-center justify-between px-2 py-3 shrink-0">
        <h2 className="text-sm font-medium">
          评论
          {total > 0 && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({formatCount(total)})
            </span>
          )}
        </h2>
      </header>

      <div className="flex-1 relative">
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground transition-all duration-300",
            allComments.length === 0
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95 pointer-events-none",
          )}
        >
          <MessageSquare className="size-10 opacity-30" />
          <p className="text-xs">暂无评论</p>
        </div>

        <div
          className={cn(
            "h-full transition-all duration-300 px-2 mr-4",
            allComments.length > 0
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2 pointer-events-none",
          )}
        >
          <Virtuoso
            components={{ Scroller: VirtuosoScroller }}
            computeItemKey={(index) => allComments[index]?.commentId ?? index}
            itemContent={(index) => (
              <CommentItem
                comment={allComments[index]}
                isHot={index < hotCount}
              />
            )}
            overscan={20}
            style={{ height: "100%" }}
            totalCount={allComments.length}
          />
        </div>
      </div>
    </div>
  );
};
