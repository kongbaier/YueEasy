import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Compute shortest circular path direction from `from` to `to`. */
function shortestDir(from: number, to: number, len: number): 1 | -1 {
  const forward = (to - from + len) % len;
  const backward = (from - to + len) % len;
  return forward <= backward ? 1 : -1;
}

interface AnimationState {
  /** @param target — The index of the item to move to. */
  target: number;
  /**
   * @param direction — The direction of the animation. 1 = forward, -1 = backward. Determines which side the target item comes
   *  from and parallax direction.
   */
  direction: 1 | -1;
}

interface ParallaxCarouselProps<T> {
  items: T[];
  /**
   * Render an item.
   * @param parallaxOffset — counter-shift for parallax. Ranges -speed..+speed.
   *   Content should translate by `parallaxOffset * 100%` of container width.
   *   Content must be wider than container to avoid gaps.
   * @param isAnimating — true while CSS transition is active.
   */
  children?:
    | ((
        item: T,
        index: number,
        parallaxOffset: number,
        isAnimating: boolean,
      ) => React.ReactNode)
    | React.ReactNode;

  className?: string;
  /** Fraction of wrapper speed for the inner parallax. 0 = no parallax, 0.5 = 50%. Default 0. */
  parallaxSpeed?: number;
  /** Key extractor for stable dots. Defaults to index. */
  getKey?: (item: T, index: number) => string;
  /** Show shimmer skeleton placeholder while data loads. */
  loading?: boolean;
}

const DURATION_MS = 700;

export function ParallaxCarousel<T>({
  items,
  children,
  className,
  parallaxSpeed = 0,
  getKey,
  loading,
}: ParallaxCarouselProps<T>) {
  if (loading) {
    return (
      <Skeleton className={cn("h-full w-full rounded-xl", className)} shimmer />
    );
  }

  const len = items.length;

  const [current, setCurrent] = useState(0);
  const [animation, setAnimation] = useState<AnimationState | null>(null);
  const [started, setStarted] = useState(false);

  // Guard against double transitionend firing.
  const endedRef = useRef(false);

  // Reset current if items shrink past it.
  useEffect(() => {
    if (current >= len && len > 0) setCurrent(0);
  }, [current, len]);

  const move = useCallback(
    (targetIndex: number) => {
      if (animation !== null || targetIndex === current || len <= 1) return;
      const dir = shortestDir(current, targetIndex, len);
      setAnimation({ target: targetIndex, direction: dir });
      setStarted(false);
      endedRef.current = false;
    },
    [animation, current, len],
  );

  const goNext = useCallback(
    () => move((current + 1) % len),
    [current, len, move],
  );
  const goPrev = useCallback(
    () => move((current - 1 + len) % len),
    [current, len, move],
  );

  // After the browser paints the start positions, enable CSS transitions.
  useLayoutEffect(() => {
    if (animation && !started) {
      const raf = requestAnimationFrame(() => setStarted(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [animation, started]);

  const handleTransitionEnd = useCallback(() => {
    if (!animation || !started || endedRef.current) return;
    endedRef.current = true;
    setCurrent(animation.target);
    setAnimation(null);
    setStarted(false);
  }, [animation, started]);

  if (len === 0) return null;

  const isAnimating = animation !== null && started;
  const dir = animation?.direction ?? 1;
  const targetIdx = animation?.target ?? 0;

  // Counter-shift offsets: content inside wrapper moves opposite to wrapper at a fraction of speed.
  const currentOffset = started ? dir * parallaxSpeed : 0;
  const targetOffset = started ? 0 : -dir * parallaxSpeed;

  const displayIndex = animation?.target ?? current;

  return (
    <div
      className={cn("relative h-full w-full group overflow-hidden", className)}
    >
      {/* Current item */}
      <div
        className={cn(
          "absolute inset-0",
          `transform duration-${DURATION_MS} ease-out`,
        )}
        key={current}
        onTransitionEnd={handleTransitionEnd}
        style={{
          transform: started
            ? `translateX(${dir === 1 ? "-" : ""}100%)`
            : "translateX(0)",
        }}
      >
        {typeof children === "function"
          ? children(items[current], current, currentOffset, isAnimating)
          : children}
      </div>

      {/* Target item — only mounted during animation */}
      {animation && (
        <div
          className={cn(
            "absolute inset-0",
            `transition-transform duration-${DURATION_MS} ease-out`,
          )}
          onTransitionEnd={handleTransitionEnd}
          style={{
            transform: started
              ? "translateX(0)"
              : `translateX(${dir === 1 ? "" : "-"}100%)`,
          }}
        >
          {typeof children === "function"
            ? children(items[targetIdx], targetIdx, targetOffset, isAnimating)
            : children}
        </div>
      )}

      {/* Controls */}
      {len > 1 && (
        <>
          <button
            className={cn(
              "absolute left-2 top-1/2 z-10 -translate-y-1/2 transition-all duration-150 ease-out",
              "rounded-full bg-background/60 p-1.5 text-foreground hover:bg-background/80 hover:scale-95 active:scale-90",
              "opacity-0 group-hover:opacity-100",
            )}
            onClick={goPrev}
            type="button"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            className={cn(
              "absolute right-2 top-1/2 z-10 -translate-y-1/2 transition-all duration-150 ease-out",
              "rounded-full bg-background/60 p-1.5 text-foreground hover:bg-background/80 hover:scale-95 active:scale-90",
              "opacity-0 group-hover:opacity-100",
            )}
            onClick={goNext}
            type="button"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute h-4 right-4 bottom-4 z-10 flex gap-1.5 items-center">
            {items.map((item, i) => (
              <button
                className="group/btn cursor-pointer h-full"
                key={getKey ? getKey(item, i) : i}
                onClick={() => move(i)}
                type="button"
              >
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full drop-shadow-2xl transition-[colors,scale] origin-center",
                    i === displayIndex
                      ? "bg-white scale-110"
                      : "bg-white/50 group-hover/btn:bg-white/70 group-hover/btn:scale-110",
                  )}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
