import { cn } from "@/shared/utils/cn";
import React from "react";

interface SkeletonProps extends React.ComponentProps<"div"> {
  shimmer?: boolean;
}

function Skeleton({ className, shimmer, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted",
        shimmer
          ? "animate-shimmer bg-shimmer bg-size-[200%_100%]"
          : "animate-pulse",
        className,
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}

export type { SkeletonProps };
export { Skeleton };
