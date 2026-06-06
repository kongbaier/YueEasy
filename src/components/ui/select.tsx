import { Select as SelectPrimitive } from "@base-ui/react/select";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

function Root<T>({
  ...props
}: SelectPrimitive.Root.Props<T, false>) {
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
        "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground whitespace-nowrap outline-none transition-all",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "hover:bg-muted",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDown className="size-4 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function Value({
  className,
  ...props
}: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      className={cn("truncate", className)}
      {...props}
    />
  );
}

function Portal({
  ...props
}: SelectPrimitive.Portal.Props) {
  return <SelectPrimitive.Portal {...props} />;
}

function Positioner({
  className,
  ...props
}: SelectPrimitive.Positioner.Props) {
  return (
    <SelectPrimitive.Positioner
      sideOffset={4}
      className={cn(className)}
      {...props}
    />
  );
}

function Popup({
  className,
  children,
  ...props
}: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Popup
      className={cn(
        "z-50 min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg transition-all data-[ending-style]:scale-95 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className,
      )}
      {...props}
    >
      {children}
    </SelectPrimitive.Popup>
  );
}

function Arrow({
  className,
  ...props
}: SelectPrimitive.Arrow.Props) {
  return (
    <SelectPrimitive.Arrow
      className={cn("fill-card", className)}
      {...props}
    />
  );
}

function List({
  className,
  ...props
}: SelectPrimitive.List.Props) {
  return (
    <SelectPrimitive.List
      className={cn("max-h-60 overflow-auto outline-none", className)}
      {...props}
    />
  );
}

function Item({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none transition-colors select-none",
        "data-[highlighted]:bg-primary-lightest data-[highlighted]:text-foreground",
        "data-[selected]:font-medium",
        className,
      )}
      {...props}
    >
      {children}
    </SelectPrimitive.Item>
  );
}

function ItemText({
  className,
  ...props
}: SelectPrimitive.ItemText.Props) {
  return (
    <SelectPrimitive.ItemText
      className={cn("flex-1", className)}
      {...props}
    />
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
