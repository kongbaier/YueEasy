import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SKELETON_COUNT = 8;

function CardSkeleton({ index }: { index: number }) {
  return (
    <div className="w-30 lg:w-36 xl:w-40 2xl:w-44 shrink-0 snap-start">
      <Skeleton className="aspect-square w-full rounded-lg" shimmer />
      <Skeleton
        className="mt-2 h-4 w-3/4"
        shimmer
        style={{ animationDelay: `${index * 100}ms` }}
      />
    </div>
  );
}

interface HorizontalScrollSectionProps {
  title: string;
  titleLink?: string;
  children?: ReactNode;
  loading?: boolean;
}

export function HorizontalScrollSection({
  title,
  titleLink,
  children,
  loading,
}: HorizontalScrollSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateButtons();
    el.addEventListener("scroll", updateButtons, { passive: true });
    const observer = new ResizeObserver(updateButtons);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateButtons);
      observer.disconnect();
    };
  }, [updateButtons]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth - 64;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        {titleLink ? (
          <Link
            className="text-lg font-bold transition-colors hover:text-accent-foreground/70"
            to={titleLink}
          >
            {title}
          </Link>
        ) : (
          <h2 className="text-lg font-bold">{title}</h2>
        )}
        <div className="flex gap-1">
          <button
            className={cn(
              "rounded-full p-1 transition-colors",
              canLeft
                ? "text-foreground hover:bg-accent"
                : "text-muted-foreground/30",
            )}
            disabled={!canLeft}
            onClick={() => scroll("left")}
            type="button"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            className={cn(
              "rounded-full p-1 transition-colors",
              canRight
                ? "text-foreground hover:bg-accent"
                : "text-muted-foreground/30",
            )}
            disabled={!canRight}
            onClick={() => scroll("right")}
            type="button"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden"
        ref={scrollRef}
      >
        {loading
          ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <CardSkeleton index={i} key={i} />
            ))
          : children}
      </div>
    </section>
  );
}
