import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/** Compute shortest circular path direction from `from` to `to`. */
function shortestDir(from: number, to: number, len: number): 1 | -1 {
  const forward = (to - from + len) % len;
  const backward = (from - to + len) % len;
  return forward <= backward ? 1 : -1;
}

interface AnimationState {
  target: number;
  dir: 1 | -1;
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
  renderItem: (
    item: T,
    index: number,
    parallaxOffset: number,
    isAnimating: boolean,
  ) => React.ReactNode;
  className?: string;
  /** Fraction of wrapper speed for the inner parallax. 0 = no parallax, 0.5 = 50%. Default 0. */
  parallaxSpeed?: number;
  /** Key extractor for stable dots. Defaults to index. */
  getKey?: (item: T, index: number) => string;
}

const DURATION_MS = 700;

export function ParallaxCarousel<T>({
  items,
  renderItem,
  className,
  parallaxSpeed = 0,
  getKey,
}: ParallaxCarouselProps<T>) {
  const len = items.length;

  const [current, setCurrent] = useState(0);
  const [anim, setAnim] = useState<AnimationState | null>(null);
  const [started, setStarted] = useState(false);

  // Guard against double transitionend firing.
  const endedRef = useRef(false);

  // Reset current if items shrink past it.
  useEffect(() => {
    if (current >= len && len > 0) setCurrent(0);
  }, [current, len]);

  const move = useCallback(
    (targetIndex: number) => {
      if (anim !== null || targetIndex === current || len <= 1) return;
      const dir = shortestDir(current, targetIndex, len);
      setAnim({ target: targetIndex, dir });
      setStarted(false);
      endedRef.current = false;
    },
    [anim, current, len],
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
    if (anim && !started) {
      const raf = requestAnimationFrame(() => setStarted(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [anim, started]);

  const handleTransitionEnd = useCallback(() => {
    if (!anim || !started || endedRef.current) return;
    endedRef.current = true;
    setCurrent(anim.target);
    setAnim(null);
    setStarted(false);
  }, [anim, started]);

  if (len === 0) return null;

  const isAnimating = anim !== null && started;
  const dir = anim?.dir ?? 1;
  const targetIdx = anim?.target ?? 0;

  // Counter-shift offsets: content inside wrapper moves opposite to wrapper at a fraction of speed.
  const currentOffset = started ? dir * parallaxSpeed : 0;
  const targetOffset = started ? 0 : -dir * parallaxSpeed;

  const displayIndex = anim?.target ?? current;

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {/* Current item */}
      <div
        className="absolute inset-0"
        onTransitionEnd={handleTransitionEnd}
        style={{
          transform: isAnimating
            ? `translateX(${dir === 1 ? "-" : ""}100%)`
            : "translateX(0)",
          transition: isAnimating
            ? `transform ${DURATION_MS}ms ease-out`
            : "none",
        }}
      >
        {renderItem(items[current], current, currentOffset, isAnimating)}
      </div>

      {/* Target item — only mounted during animation */}
      {anim && (
        <div
          className="absolute inset-0"
          onTransitionEnd={handleTransitionEnd}
          style={{
            transform: started
              ? "translateX(0)"
              : `translateX(${dir === 1 ? "" : "-"}100%)`,
            transition: started
              ? `transform ${DURATION_MS}ms ease-out`
              : "none",
          }}
        >
          {renderItem(items[targetIdx], targetIdx, targetOffset, isAnimating)}
        </div>
      )}

      {/* Controls */}
      {len > 1 && (
        <>
          <button
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white hover:bg-black/60"
            onClick={goPrev}
            type="button"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white hover:bg-black/60"
            onClick={goNext}
            type="button"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute right-4 bottom-4 z-10 flex gap-1.5">
            {items.map((item, i) => (
              <button
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === displayIndex ? "bg-white" : "bg-white/50",
                )}
                key={getKey ? getKey(item, i) : i}
                onClick={() => move(i)}
                type="button"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
