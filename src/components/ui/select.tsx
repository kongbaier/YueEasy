import { Select as SelectPrimitive } from "@base-ui/react/select";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

function Root<T>({ ...props }: SelectPrimitive.Root.Props<T, false>) {
  return <SelectPrimitive.Root {...props} />;
}

function Trigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/40 px-3 text-sm text-foreground whitespace-nowrap outline-none backdrop-blur-sm transition-all duration-200",
        "hover:border-border hover:bg-muted/60 hover:shadow-sm",
        "focus-visible:border-ring/40 focus-visible:ring-2 focus-visible:ring-ring/20",
        "disabled:pointer-events-none disabled:opacity-40",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-300",
        "[&[data-popup-open]_svg]:rotate-180",
        "[&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDown className="size-4 text-muted-foreground/70" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function Value({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value className={cn("truncate", className)} {...props} />
  );
}

function Portal({ ...props }: SelectPrimitive.Portal.Props) {
  return <SelectPrimitive.Portal {...props} />;
}

function Positioner({ className, ...props }: SelectPrimitive.Positioner.Props) {
  return (
    <SelectPrimitive.Positioner
      align="start"
      className={cn(className)}
      sideOffset={6}
      {...props}
    />
  );
}

function Popup({ className, children, ...props }: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Popup
      className={cn(
        "z-50 overflow-hidden rounded-md border border-border/30 bg-popover/85 p-1 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04),0_8px_20px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-all duration-200 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_2px_4px_rgba(0,0,0,0.12),0_8px_20px_rgba(0,0,0,0.24)]",
        "data-ending-style:scale-95 data-starting-style:scale-95 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className,
      )}
      style={{
        minWidth: "calc(var(--anchor-width) + 0.5rem)",
        transformOrigin: "var(--transform-origin)",
      }}
      {...props}
    >
      {children}
    </SelectPrimitive.Popup>
  );
}

function Arrow({ className, ...props }: SelectPrimitive.Arrow.Props) {
  return (
    <SelectPrimitive.Arrow className={cn("fill-card", className)} {...props} />
  );
}

function List({ className, ...props }: SelectPrimitive.List.Props) {
  return (
    <SelectPrimitive.List
      className={cn("max-h-60 overflow-auto outline-none space-y-1", className)}
      {...props}
    />
  );
}

function Item({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-sm px-3 py-1.5 text-sm text-foreground outline-none select-none transition-all duration-150",
        "before:absolute before:left-0.75 before:top-1/2 before:-translate-y-1/2 before:h-3.5 before:w-0.75 before:rounded-full before:bg-primary before:scale-y-0 before:transition-transform before:duration-200 before:ease-out",
        "data-highlighted:bg-accent/60",
        "data-selected:bg-accent/70 data-selected:font-medium data-selected:before:scale-y-100",
        className,
      )}
      {...props}
    >
      {children}
    </SelectPrimitive.Item>
  );
}

function ItemText({ className, ...props }: SelectPrimitive.ItemText.Props) {
  return (
    <SelectPrimitive.ItemText className={cn("flex-1", className)} {...props} />
  );
}

function ItemIndicator({
  className,
  ...props
}: SelectPrimitive.ItemIndicator.Props) {
  return <SelectPrimitive.ItemIndicator {...props} />;
}

export const Select = {
  Root,
  Trigger,
  Value,
  Portal,
  Positioner,
  Popup,
  Arrow,
  List,
  Item,
  ItemText,
  ItemIndicator,
};
