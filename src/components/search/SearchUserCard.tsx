import { User } from "lucide-react";
import { ImageWithFade } from "@/components/common/image";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/lib/format";
import { getNcmImageUrl } from "@/lib/utils";
import type { NcmSearchUser } from "@/services/ncm";

interface SearchUserCardProps {
  item: NcmSearchUser;
}

export function SearchUserCard({ item }: SearchUserCardProps) {
  return (
    <div className="group cursor-pointer rounded-lg p-3 transition-colors hover:bg-accent text-center">
      <div className="relative mx-auto mb-2 w-full max-w-[160px] aspect-square overflow-hidden rounded-full">
        {item.avatarUrl ? (
          <ImageWithFade
            alt={item.nickname}
            className="h-full w-full object-cover"
            src={getNcmImageUrl(item.avatarUrl, 150)}
          />
        ) : (
          <span className="h-full w-full bg-muted flex items-center justify-center rounded-full">
            <User className="size-8 text-muted-foreground" />
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
          {item.followeds > 0 ? `${formatCount(item.followeds)} 粉丝` : ""}
        </p>
      )}
    </div>
  );
}

export function SearchUserCardSkeleton() {
  return (
    <div className="rounded-lg p-3 flex flex-col items-center">
      <Skeleton className="w-full max-w-[160px] aspect-square rounded-full" shimmer />
      <Skeleton className="h-4 w-2/3 mt-2 rounded" shimmer />
      <Skeleton className="h-3 w-1/2 mt-1 rounded" shimmer />
    </div>
  );
}
