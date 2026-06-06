import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ImgStatus = "loading" | "loaded" | "error";

interface ImageWithFadeProps extends React.ComponentProps<"img"> {
  fallback?: React.ReactNode;
  fill?: boolean;
}

function ImageWithFade({
  className,
  src,
  alt,
  fallback,
  fill,
  ...rest
}: ImageWithFadeProps) {
  const [status, setStatus] = useState<ImgStatus>("loading");
  const mountedRef = useRef(true);
  const prevSrcRef = useRef(src);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!src) {
      setStatus("error");
      return;
    }

    if (src !== prevSrcRef.current) {
      setStatus("loading");
      prevSrcRef.current = src;
    }

    let cancelled = false;
    const img = new Image();
    img.src = src;
    img
      .decode()
      .then(() => {
        if (!cancelled && mountedRef.current) setStatus("loaded");
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  const showShimmer = status === "loading";
  const showImg = status === "loaded";

  return (
    <span
      className={cn(
        "relative leading-0",
        fill ? "block h-full w-full" : "inline-block",
      )}
    >
      {showShimmer && (
        <span className="absolute inset-0 z-10 bg-shimmer animate-shimmer bg-size-[200%_100%]" />
      )}
      {status === "error" &&
        (fallback ?? <span className="absolute inset-0 bg-muted" />)}
      <img
        alt={alt}
        className={cn(
          className,
          fill && "h-full w-full",
          "transition-opacity duration-300",
          showImg ? "opacity-100" : "opacity-0",
        )}
        src={showImg ? src : undefined}
        {...rest}
      />
    </span>
  );
}

export type { ImageWithFadeProps };
export { ImageWithFade };
