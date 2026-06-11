import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CarouselApi } from "@/components/ui/carousel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

interface ParallaxCarouselProps<T> {
  className?: string;
  items: T[];
  getKey?: (item: T, index: number) => string;
  children?: ((item: T) => React.ReactNode) | React.ReactNode;
  /** 视差强度，0 = 无效果，默认 0.15 */
  parallaxSpeed?: number;
}

export const ParallaxCarousel = <T,>({
  className,
  children,
  items,
  getKey,
  parallaxSpeed = 0.15,
}: ParallaxCarouselProps<T>) => {
  const [api, setApi] = useState<CarouselApi>();
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = useCallback(() => {
    if (!api) return;
    setScrollProgress(api.scrollProgress());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    api.on("scroll", handleScroll);
    handleScroll();
    return () => {
      api.off("scroll", handleScroll);
    };
  }, [api, handleScroll]);

  const len = items.length;
  const progressInSlides = scrollProgress * len;
  const displayIndex = ((Math.round(progressInSlides) % len) + len) % len;

  return (
    <Carousel
      className={cn("relative h-full w-full group overflow-hidden", className)}
      opts={{ loop: true }}
      setApi={setApi}
    >
      <CarouselContent className="h-full m-0">
        {items.map((item, index) => {
          let offset = progressInSlides - index;
          if (offset > len / 2) offset -= len;
          if (offset < -len / 2) offset += len;
          const parallaxOffset = offset * parallaxSpeed;

          return (
            <CarouselItem
              className="p-0 overflow-hidden"
              key={getKey ? getKey(item, index) : index}
            >
              <div
                className="relative h-full w-full"
                style={{
                  transform: `translateX(${parallaxOffset * 100}%)`,
                }}
              >
                {typeof children === "function" ? children(item) : children}
              </div>
            </CarouselItem>
          );
        })}
      </CarouselContent>

      {len > 1 && (
        <>
          <div className="absolute left-2 top-1/2 z-10 -translate-y-1/2">
            <Button
              className={cn(
                "transition-all duration-150 ease-out",
                "rounded-full bg-background/60 p-1.5 text-foreground hover:bg-background/80 hover:scale-95 active:scale-90",
                "opacity-0 group-hover:opacity-100",
              )}
              onClick={() => api?.scrollPrev()}
              type="button"
            >
              <ChevronLeft className="size-5 -translate-x-px" />
            </Button>
          </div>
          <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
            <Button
              className={cn(
                "transition-all duration-150 ease-out",
                "rounded-full bg-background/60 p-1.5 text-foreground hover:bg-background/80 hover:scale-95 active:scale-90",
                "opacity-0 group-hover:opacity-100",
              )}
              onClick={() => api?.scrollNext()}
              type="button"
            >
              <ChevronRight className="size-5 translate-x-px" />
            </Button>
          </div>

          <div className="absolute h-4 right-4 bottom-4 z-10 flex gap-1.5 items-center">
            {items.map((item, i) => (
              <Button
                className="group/btn cursor-pointer h-full p-0 hover:bg-transparent"
                key={getKey ? getKey(item, i) : i}
                onClick={() => api?.scrollTo(i)}
                type="button"
                variant="ghost"
              >
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full drop-shadow-2xl transition-[colors,scale] origin-center",
                    i === displayIndex
                      ? "bg-white scale-110"
                      : "bg-white/50 group-hover/btn:bg-white/70 group-hover/btn:scale-110",
                  )}
                />
              </Button>
            ))}
          </div>
        </>
      )}
    </Carousel>
  );
};
