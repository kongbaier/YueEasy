import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import React from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

const SKELETON_COUNT = 8;

function CardSkeleton({ index }: { index: number }) {
  return (
    <div className="w-30 lg:w-36 xl:w-40 2xl:w-44 shrink-0">
      <Skeleton className="aspect-square w-full rounded-lg" shimmer />
      <Skeleton
        className="mt-2 h-4 w-3/4"
        shimmer
        style={{ animationDelay: `${index * 100}ms` }}
      />
    </div>
  );
}

function ScrollButtons() {
  const { api, canScrollPrev, canScrollNext } = useCarousel();

  const scroll = (direction: "left" | "right") => {
    if (!api) return;
    const firstSlide = api.slideNodes()[0];
    if (!firstSlide) return;
    const viewport = api.containerNode().parentElement;
    if (!viewport) return;
    const cardWidth = firstSlide.offsetWidth;
    const visibleCards = Math.floor(viewport.clientWidth / cardWidth);
    const steps = Math.max(1, Math.floor(visibleCards / 2));
    const snaps = api.scrollSnapList();
    const current = api.selectedScrollSnap();
    const targetIndex =
      direction === "right"
        ? Math.min(snaps.length - 1, current + steps)
        : Math.max(0, current - steps);
    api.scrollTo(targetIndex);
  };

  return (
    <div className="flex gap-1">
      <button
        className={cn(
          "rounded-full p-1 transition-colors",
          canScrollPrev
            ? "text-foreground hover:bg-accent"
            : "text-muted-foreground/30",
        )}
        disabled={!canScrollPrev}
        onClick={() => scroll("left")}
        type="button"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        className={cn(
          "rounded-full p-1 transition-colors",
          canScrollNext
            ? "text-foreground hover:bg-accent"
            : "text-muted-foreground/30",
        )}
        disabled={!canScrollNext}
        onClick={() => scroll("right")}
        type="button"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

interface HorizontalCarouselProps {
  title: string;
  titleLink?: string;
  children?: ReactNode;
  loading?: boolean;
}

export function HorizontalCarousel({
  title,
  titleLink,
  children,
  loading,
}: HorizontalCarouselProps) {
  return (
    <section>
      <Carousel opts={{ loop: false, align: "start", containScroll: "trimSnaps" }}>
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
          <ScrollButtons />
        </div>
        <CarouselContent>
          {loading
            ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <CarouselItem key={i} className="basis-auto">
                  <CardSkeleton index={i} />
                </CarouselItem>
              ))
            : React.Children.map(children, (child) => (
                <CarouselItem className="basis-auto">{child}</CarouselItem>
              ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}
