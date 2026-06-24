import { ImageWithFade } from "@/components/common/image";
import { cn } from "@/lib/utils";

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
}: CoverProps) => (
  <div className={cn("isolate relative", className)}>
    {src && (
      <img
        alt=""
        aria-hidden="true"
        className="absolute inset-0 object-cover blur-lg opacity-80 scale-96 -z-1"
        src={src}
      />
    )}
    <ImageWithFade
      alt={alt}
      className={cn(
        "object-cover relative overflow-hidden",
        foregroundClassName,
      )}
      fill
      src={src}
    />
  </div>
);
