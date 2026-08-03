import { useId } from "react";
import { ImageTransition } from "./ImageTransition";
import { cn } from "@/shared/lib/utils";

interface CoverProps {
  src: string | undefined;
  alt: string;
  className?: string;
  foregroundClassName?: string;
}

export const Cover = ({
  src,
  alt,
  className,
  foregroundClassName,
}: CoverProps) => {
  const filterId = useId();

  return (
    <div
      className={cn("isolate relative", className)}
      style={src ? { filter: `url(#${filterId})` } : undefined}
    >
      {/* SVG 滤镜定义：光晕作用于根容器，跟随 ImageTransition 的过渡 */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.6" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {src && (
        <ImageTransition
          alt={alt}
          containerClassName={cn("size-full", foregroundClassName)}
          src={src}
        />
      )}
    </div>
  );
};
