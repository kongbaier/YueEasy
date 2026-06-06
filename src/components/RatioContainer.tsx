import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export const RatioContainer = ({
  children,
  className,
  ratio = 1,
}: PropsWithChildren & { ratio?: number; className?: string }) => {
  if (ratio <= 0) throw new Error("Ratio must be greater than 0");

  return (
    <div
      className={cn(
        "h-full w-full flex justify-center items-center",
        className,
      )}
      style={{ containerType: "size" }}
    >
      <div
        style={{
          aspectRatio: String(ratio),
          width: `min(100cqw, calc(100cqh * ${ratio}))`,
          display: "grid",
        }}
      >
        {children}
      </div>
    </div>
  );
};
