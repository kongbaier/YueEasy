import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";

type ImgStatus = "loading" | "loaded" | "error";

export interface ImageWithFadeProps extends React.ComponentProps<"img"> {
  fallback?: React.ReactNode;
  fill?: boolean;
}

/**
 * Image component that supports crossfade transition when `src` changes.
 *
 * - First load: shimmer placeholder → image loads → fade in (opacity 0→1)
 * - Src change: the old image is promoted to a top-layer prevImage (opacity-100).
 *   The current `<img>` stays at opacity-100 behind it while the browser loads
 *   the new src in-place. Once loaded, prevImage fades out (1→0), revealing the
 *   new image underneath — a smooth crossfade without DOM teardown/rebuild.
 * - Error: shows the `fallback` element, or a muted background by default.
 */
export const ImageWithFade = ({
  className,
  src,
  alt,
  fallback,
  fill,
  ...rest
}: ImageWithFadeProps) => {
  const [currStatus, setCurrStatus] = useState<ImgStatus>("loading");
  const [prevImage, setPrevImage] = useState<{
    src: string;
    fading: boolean;
  } | null>(null);

  const prevSrcRef = useRef<string | null>(null);
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── When src changes, stash the old image as "prev" on top ──
  //     The current <img> keeps opacity-100 behind it, browser swaps content
  //     when the new src loads; then prevImage fades out → crossfade.
  useEffect(() => {
    const oldSrc = prevSrcRef.current;
    prevSrcRef.current = src ?? null;

    if (oldSrc && oldSrc !== src) {
      setPrevImage({ src: oldSrc, fading: false });
      // keep currStatus at "loaded" so the current <img> stays at opacity-100
    }
    // Initial mount: currStatus is already "loading" — no action needed.
  }, [src]);

  // Cleanup the timer on unmount
  useEffect(() => {
    return () => {
      if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
    };
  }, []);

  // ── Handlers ──

  const handleLoad = () => {
    setCurrStatus("loaded");

    // Defer the crossfade check so that useEffect (which sets prevImage on
    // src change) has a chance to run first.  This matters when the browser
    // fires onLoad synchronously from cache — without the deferral prevImage
    // would still be null in the closure and the crossfade would be skipped.
    setTimeout(() => {
      setPrevImage((prev) => {
        if (!prev || prev.fading) return prev;

        if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
        cleanupTimer.current = setTimeout(() => {
          setPrevImage(null);
        }, 300);

        return { ...prev, fading: true };
      });
    }, 0);
  };

  const handleError = () => {
    setCurrStatus("error");
    setPrevImage(null);
    if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
  };

  // ── Derived visibility ──

  const showShimmer = currStatus === "loading" && !prevImage;
  const showFallback = currStatus === "error" && !prevImage;

  // ── Render ──

  return (
    <div
      className={cn(
        "relative leading-0",
        fill ? "block h-full w-full" : "inline-block",
      )}
    >
      {/* Shimmer (only on first load, before any image is visible) */}
      {showShimmer && (
        <span className="absolute inset-0 z-30 bg-shimmer animate-shimmer bg-size-[200%_100%]" />
      )}

      {/* Fallback (error state) */}
      {showFallback &&
        (fallback ?? <span className="absolute inset-0 z-30 bg-muted" />)}

      {/* ── Previous image (fading out) ── */}
      {prevImage && (
        <img
          key={`prev-${prevImage.src}`}
          alt={alt}
          className={cn(
            className,
            fill && "h-full w-full",
            "absolute inset-0 select-none z-30",
            prevImage.fading
              ? "transition-opacity duration-300 opacity-0"
              : "opacity-100",
          )}
          src={prevImage.src}
          draggable={false}
        />
      )}

      {/* ── Current image (in-flow, provides sizing for container) ── */}
      {(currStatus === "loading" || currStatus === "loaded") && (
        <img
          alt={alt}
          className={cn(
            className,
            fill && "h-full w-full",
            "relative z-20",
            "transition-opacity duration-300",
            currStatus === "loaded" ? "opacity-100" : "opacity-0",
          )}
          {...rest}
          onLoad={handleLoad}
          onError={handleError}
          src={src}
        />
      )}
    </div>
  );
};
