import { useSuspenseQuery } from "@tanstack/react-query";
import { MessageCircle, ThumbsUp } from "lucide-react";
import { ImageWithFade } from "@/components/ui/image";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/lib/format";
import { cn, getNcmImageUrl } from "@/lib/utils";
import { ncm } from "@/services/ncm";
import type { NcmComment } from "@/services/ncm/types/comment.response";

/* ------------------------------------------------------------------ */
/*  工具                                                               */
/* ------------------------------------------------------------------ */

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* ------------------------------------------------------------------ */
/*  单条评论                                                           */
/* ------------------------------------------------------------------ */

const CommentItem = ({ comment }: { comment: NcmComment }) => (
  <div
    className={cn(
      "rounded-lg px-3 py-2.5",
      "hover:bg-accent/50 transition-colors",
    )}
  >
    {/* 用户行 */}
    <div className="flex items-center gap-2">
      <ImageWithFade
        alt={comment.user.nickname}
        className="h-7 w-7 shrink-0 rounded-full object-cover"
        src={getNcmImageUrl(comment.user.avatarUrl, 50)}
      />
      <span className="text-xs font-medium truncate">
        {comment.user.nickname}
      </span>
      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
        {formatTime(comment.time)}
      </span>
    </div>

    {/* 内容 */}
    <p className="mt-1.5 text-xs leading-relaxed text-foreground/85">
      {comment.content}
    </p>

    {/* 被回复内容（如果有） */}
    {comment.beReplied && comment.beReplied.length > 0 && (
      <div className="mt-1.5 ml-2 pl-2 border-l-2 border-border/40 space-y-1">
        {comment.beReplied.map((reply) => (
          <p
            className="text-[11px] text-muted-foreground leading-relaxed"
            key={reply.beRepliedCommentId}
          >
            <span className="text-primary/80">@{reply.user.nickname}</span>{" "}
            {reply.content}
          </p>
        ))}
      </div>
    )}

    {/* 点赞 */}
    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
      <ThumbsUp className="h-3 w-3" />
      <span>
        {comment.likedCount > 0 ? formatCount(comment.likedCount) : ""}
      </span>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  骨架                                                               */
/* ------------------------------------------------------------------ */

const CommentSkeleton = () => (
  <div className="space-y-1">
    {Array.from({ length: 5 }).map((_, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton array
      <div className="flex gap-2 rounded-lg px-3 py-2.5" key={`sk-${i}`}>
        <Skeleton className="h-7 w-7 shrink-0 rounded-full" shimmer />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-16 rounded" shimmer />
            <Skeleton className="h-3 w-20 rounded ml-auto" shimmer />
          </div>
          <Skeleton className="h-3 w-full rounded" shimmer />
          <Skeleton className="h-3 w-3/4 rounded" shimmer />
        </div>
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/*  评论面板内容                                                        */
/* ------------------------------------------------------------------ */

interface CommentPanelContentProps {
  playlistId: number;
}

const CommentPanelContent = ({ playlistId }: CommentPanelContentProps) => {
  const { data } = useSuspenseQuery({
    queryKey: ["playlistComments", playlistId],
    queryFn: () =>
      ncm.commentPlaylist(playlistId, 30).then((res) => ({
        comments: res.comments ?? [],
        hotComments: res.hotComments ?? [],
        totalCount: res.total ?? 0,
      })),
  });

  const { comments, hotComments, totalCount } = data;

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="flex items-center gap-2 px-1">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">评论</span>
        {totalCount > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatCount(totalCount)}
          </span>
        )}
      </div>

      {!comments.length && !hotComments.length ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <MessageCircle className="h-8 w-8 opacity-30" />
          <p className="text-xs">暂无评论</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {/* 精彩评论 */}
          {hotComments.length > 0 && (
            <div className="space-y-0.5">
              <p className="px-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                精彩评论
              </p>
              {hotComments.map((c) => (
                <CommentItem comment={c} key={c.commentId} />
              ))}
            </div>
          )}

          {/* 最新评论 */}
          {comments.length > 0 && (
            <div className="space-y-0.5">
              {hotComments.length > 0 && (
                <p className="px-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide mt-3">
                  最新评论
                </p>
              )}
              {comments.map((c) => (
                <CommentItem comment={c} key={c.commentId} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  导出                                                               */
/* ------------------------------------------------------------------ */

interface CommentPanelProps {
  playlistId: number;
}

export const CommentPanel = ({ playlistId }: CommentPanelProps) => {
  return <CommentPanelContent playlistId={playlistId} />;
};

export { CommentSkeleton };
