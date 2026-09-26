import { useEffect } from 'react';
import { Heart, MessageSquare } from 'lucide-react';
import { DecodedImage } from '@/shared/ui/image';
import { formatCount } from '@/shared/utils/format';
import { toast } from '@/shared/lib/toast';
import { getNcmImageUrl } from '@/shared/utils/image';
import { useComments } from '@/features/comment/hooks/useComments';
import type { Comment } from '@/shared/types/uiModels';
import {
  PlayerTabBody,
  PlayerTabPanel,
  PlayerTabState,
} from './PlayerTabPanel';
import { usePlayer } from '../hooks/usePlayer';

function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '刚刚';
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
  comment: Comment;
  isHot?: boolean;
}

const CommentItem = ({ comment, isHot }: CommentItemProps) => {
  return (
    <div className="group flex gap-3 px-2 py-3 w-full text-left rounded-md">
      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
        {comment.user.avatarUrl ? (
          <DecodedImage
            alt={comment.user.nickname}
            className="size-full object-cover"
            containerClassName="size-full"
            lazy
            src={getNcmImageUrl(comment.user.avatarUrl, 50)}
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
              <span key={reply.id}>
                <span className="text-foreground/70">
                  @{reply.user?.nickname ?? ''}
                </span>
                ：{reply.content}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] text-muted-foreground/60">
            {relativeTime(comment.timeMs)}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
            <Heart className="size-2.5" />
            {comment.likedCount > 0 ? formatCount(comment.likedCount) : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

export const PlayerPageComments = () => {
  const { currentTrack } = usePlayer();
  const { data, isPending, isError } = useComments({
    type: 'music',
    id: currentTrack?.id,
  });

  useEffect(() => {
    if (isError) toast.error('加载评论失败');
  }, [isError]);

  const allComments = [...(data?.hotComments ?? []), ...(data?.comments ?? [])];
  const hotCount = data?.hotComments?.length ?? 0;

  const renderList = () => {
    if (isPending) return <PlayerTabState>加载中...</PlayerTabState>;

    if (allComments.length === 0) {
      return (
        <PlayerTabState icon={<MessageSquare className="size-10 opacity-30" />}>
          暂无评论
        </PlayerTabState>
      );
    }

    return allComments.map((comment, index) => (
      <CommentItem
        comment={comment}
        isHot={index < hotCount}
        key={comment.id}
      />
    ));
  };

  return (
    <PlayerTabPanel count={data?.total ?? 0} title="评论">
      <PlayerTabBody>{renderList()}</PlayerTabBody>
    </PlayerTabPanel>
  );
};
