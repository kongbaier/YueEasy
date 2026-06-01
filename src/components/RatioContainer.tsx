import type { PropsWithChildren } from "react";

export const RatioContainer = ({
  children,
  className,
  ratio = 1,
}: PropsWithChildren & { ratio?: number; className?: string }) => {
  if (ratio <= 0) throw new Error("Ratio must be greater than 0");

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        containerType: "size",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
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
