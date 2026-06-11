import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SKELETON_COUNT = 8;

const CardSkeleton = () => {
  return (
    <div className="w-40 lg:w-44 xl:w-48 shrink-0">
      <Skeleton className="aspect-square w-full rounded-t-lg" shimmer />
      <div className="p-2.5 space-y-1.5">
        <Skeleton className="h-4 w-3/4 rounded" shimmer />
        <Skeleton className="h-3 w-1/2 rounded" shimmer />
      </div>
    </div>
  );
};

const ScrollButtons = () => {
  const { api, canScrollPrev, canScrollNext } = useCarousel();

  const scroll = (direction: "left" | "right") => {
    if (!api) return;
    const firstSlide = api.slideNodes()[0];
    if (!firstSlide) return;
    const viewport = api.containerNode().parentElement;
    if (!viewport) return;
    const cardWidth = firstSlide.offsetWidth;
    const visibleCards = Math.floor(viewport.clientWidth / cardWidth);
    const steps = Math.max(1, Math.ceil(visibleCards / 2));
    const snaps = api.scrollSnapList();
    const current = api.selectedScrollSnap();
    const targetIndex =
      direction === "right"
        ? Math.min(snaps.length - 1, current + steps)
        : Math.max(0, current - steps);
    api.scrollTo(targetIndex);
  };

  return (
    <div className="flex gap-0.5">
      <Button
        className={cn(
          "w-8 h-8 rounded-full p-1 transition-colors",
          "flex items-center justify-start",
          canScrollPrev
            ? "text-foreground hover:bg-accent"
            : "text-muted-foreground/30",
        )}
        disabled={!canScrollPrev}
        onClick={() => scroll("left")}
        type="button"
        variant="ghost"
      >
        <ChevronLeft className="size-5" />
      </Button>
      <Button
        className={cn(
          "w-8 h-8 rounded-full p-1 transition-colors",
          "flex items-center justify-end",
          canScrollNext
            ? "text-foreground hover:bg-accent"
            : "text-muted-foreground/30",
        )}
        disabled={!canScrollNext}
        onClick={() => scroll("right")}
        type="button"
        variant="ghost"
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
};

interface HorizontalCarouselProps {
  title: string;
  titleLink?: string;
  children?: ReactNode;
  loading?: boolean;
}

export const HorizontalCarousel = ({
  title,
  titleLink,
  children,
  loading,
}: HorizontalCarouselProps) => {
  return (
    <section>
      <Carousel
        opts={{ loop: false, align: "start", containScroll: "trimSnaps" }}
      >
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
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton, order never changes
                <CarouselItem className="basis-auto" key={i}>
                  <CardSkeleton />
                </CarouselItem>
              ))
            : React.Children.map(children, (child) => (
                <CarouselItem className="basis-auto">{child}</CarouselItem>
              ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
};
