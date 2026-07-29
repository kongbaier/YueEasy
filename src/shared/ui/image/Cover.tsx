import { BlurBackground } from "@/shared/ui/blur-background";
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
}: CoverProps) => (
  <div className={cn("isolate relative", className)}>
    <BlurBackground
      className="absolute w-full h-full blur-lg opacity-80 scale-95 -z-10"
      src={src}
    />
    {src && (
      <ImageTransition
        alt={alt}
        containerClassName={cn("size-full", foregroundClassName)}
        src={src}
      />
    )}
  </div>
);
