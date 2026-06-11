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
        "flex h-8 w-full items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-2.5 text-sm text-foreground whitespace-nowrap outline-none transition-colors duration-[83ms] ease-out",
        "hover:border-border hover:bg-muted",
        "focus-visible:border-ring/40 focus-visible:ring-2 focus-visible:ring-ring/20",
        "disabled:pointer-events-none disabled:opacity-30",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-150",
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
        "z-50 overflow-hidden rounded-lg border border-border/40 bg-popover p-1 shadow-lg transition duration-150 ease-out dark:shadow-black/20",
        "data-ending-style:opacity-0 data-starting-style:opacity-0",
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
    <SelectPrimitive.Arrow
      className={cn("fill-popover", className)}
      {...props}
    />
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
        "relative flex cursor-pointer items-center gap-2 rounded-[3px] px-2.5 py-1.5 text-sm text-foreground outline-none select-none transition-colors duration-[83ms] ease-out",
        "data-highlighted:bg-accent",
        "data-selected:bg-accent data-selected:font-medium",
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
