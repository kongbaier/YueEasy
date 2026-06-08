import { useCallback, useEffect, useRef, useState } from "react";
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
  const prevSrcRef = useRef(src);

  useEffect(() => {
    if (!src) {
      setStatus("error");
      return;
    }

    if (src !== prevSrcRef.current) {
      setStatus("loading");
      prevSrcRef.current = src;
    }
  }, [src]);

  // 始终让 <img> 持有 src，浏览器在挂载时就开始加载；
  // onLoad 确保图片已在该元素上完成解码后才开始 fade-in
  const handleLoad = useCallback(() => {
    setStatus("loaded");
  }, []);

  const handleError = useCallback(() => {
    setStatus("error");
  }, []);

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
        {...rest}
        src={src}
        onLoad={handleLoad}
        onError={handleError}
      />
    </span>
  );
}

export type { ImageWithFadeProps };
export { ImageWithFade };
