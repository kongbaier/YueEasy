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
}

export const ParallaxCarousel = <T,>({
  className,
  children,
  items,
  getKey,
}: ParallaxCarouselProps<T>) => {
  return (
    <Carousel
      className={cn("relative h-full w-full group overflow-hidden", className)}
      opts={{
        loop: true,
      }}
    >
      <CarouselContent className="h-full m-0">
        {items.map((item, index) => (
          <CarouselItem
            className="p-0"
            key={getKey ? getKey(item, index) : index}
          >
            <div className="relative w-full h-full">
              {typeof children === "function" ? children(item) : children}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
};
