import { User as UserIcon } from 'lucide-react';
import { Skeleton } from '@/shared/ui/skeleton';
import { DecodedImage } from '@/shared/ui/image';
import { formatCount } from '@/shared/utils/format';
import { getNcmImageUrl } from '@/shared/utils/image';
import type { User } from '@/shared/types/entities';

interface SearchUserCardProps {
  /** 用户搜索结果项 */
  item: User;
}

export function SearchUserCard({ item }: SearchUserCardProps) {
  return (
    <div className="group cursor-pointer rounded-lg p-3 transition-colors hover:bg-accent text-center">
      <div className="relative mx-auto mb-2 w-full max-w-40 aspect-square overflow-hidden rounded-full">
        {item.avatarUrl ? (
          <DecodedImage
            alt={item.nickname}
            className="h-full w-full object-cover"
            containerClassName="h-full w-full"
            src={getNcmImageUrl(item.avatarUrl, 150)}
          />
        ) : (
          <span className="h-full w-full bg-muted flex items-center justify-center rounded-full">
            <UserIcon className="size-8 text-muted-foreground" />
          </span>
        )}
      </div>
      <p className="truncate text-sm font-medium">{item.nickname}</p>
      {item.signature ? (
        <p className="truncate text-xs text-muted-foreground">
          {item.signature}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground tabular-nums">
          {(item.followeds ?? 0) > 0
            ? `${formatCount(item.followeds ?? 0)} 粉丝`
            : ''}
        </p>
      )}
    </div>
  );
}

export function SearchUserCardSkeleton() {
  return (
    <div className="rounded-lg p-3 flex flex-col items-center">
      <Skeleton
        className="w-full max-w-40 aspect-square rounded-full"
        shimmer
      />
      <Skeleton className="h-4 w-2/3 mt-2 rounded" shimmer />
      <Skeleton className="h-3 w-1/2 mt-1 rounded" shimmer />
    </div>
  );
}
