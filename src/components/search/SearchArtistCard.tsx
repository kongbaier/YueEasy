import { Mic } from "lucide-react";
import { ImageWithFade } from "@/components/common/image";
import { Skeleton } from "@/components/ui/skeleton";
import { getNcmImageUrl } from "@/lib/utils";
import type { NcmSearchArtist } from "@/services/ncm";

interface SearchArtistCardProps {
  item: NcmSearchArtist;
}

export function SearchArtistCard({ item }: SearchArtistCardProps) {
  return (
    <div className="group cursor-pointer rounded-lg p-3 transition-colors hover:bg-accent text-center">
      <div className="relative mx-auto mb-2 w-full max-w-[160px] aspect-square overflow-hidden rounded-full">
        {item.picUrl ? (
          <ImageWithFade
            alt={item.name}
            className="h-full w-full object-cover"
            src={getNcmImageUrl(item.picUrl, 150)}
          />
        ) : (
          <span className="h-full w-full bg-muted flex items-center justify-center rounded-full">
            <Mic className="size-8 text-muted-foreground" />
          </span>
        )}
      </div>
      <p className="truncate text-sm font-medium">
        {item.name}
        {item.alias?.length > 0 && (
          <span className="text-muted-foreground font-normal">
            {" "}
            ({item.alias.join(" / ")})
          </span>
        )}
      </p>
      <p className="truncate text-xs text-muted-foreground">
        {[
          item.musicSize > 0 ? `${item.musicSize} 首` : "",
          item.albumSize > 0 ? `${item.albumSize} 张专辑` : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}

export function SearchArtistCardSkeleton() {
  return (
    <div className="rounded-lg p-3 flex flex-col items-center">
      <Skeleton className="w-full max-w-[160px] aspect-square rounded-full" shimmer />
      <Skeleton className="h-4 w-2/3 mt-2 rounded" shimmer />
      <Skeleton className="h-3 w-1/3 mt-1 rounded" shimmer />
    </div>
  );
}
