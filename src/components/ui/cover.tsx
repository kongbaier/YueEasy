import { ImageWithFade } from "@/components/ui/image";
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
  <div className={cn("relative", className)}>
    {src && (
      <img
        alt=""
        aria-hidden="true"
        className="absolute inset-0 top-3 object-cover blur-lg opacity-60 scale-(92,96) -z-1"
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
