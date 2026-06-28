import type { HTMLAttributes } from "react";
import { forwardRef } from "react";

export const VirtuosoScroller = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>((props, ref) => (
  <div
    {...props}
    ref={ref}
    style={{ ...props.style, height: "100%", overflow: "auto" }}
  />
));

VirtuosoScroller.displayName = "VirtuosoScroller";
