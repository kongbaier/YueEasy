import { BlurBackground } from "@/shared/ui/blur-background";
import { ImageWithFade } from "@/shared/ui/image";
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
}: CoverProps) => (
  <div className={cn("isolat relative", className)}>
    <BlurBackground
      className="absolute w-full h-full blur-lg opacity-80 scale-95 -z-1"
      src={src}
    />
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
