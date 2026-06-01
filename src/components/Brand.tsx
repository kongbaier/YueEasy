import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn(className)}>
      <span className="text-red-400">乐</span>·易
    </div>
  );
}
