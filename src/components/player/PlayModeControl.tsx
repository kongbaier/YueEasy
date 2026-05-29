import { Repeat, Repeat1, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlayMode } from "@/core/player/types";
import { usePlayerStore } from "@/stores";

const modeIcon: Record<PlayMode, typeof Repeat> = {
  sequential: Repeat,
  shuffle: Shuffle,
  repeatOne: Repeat1,
};

export function PlayModeControl() {
  const playMode = usePlayerStore((s) => s.playMode);
  const cyclePlayMode = usePlayerStore((s) => s.cycleMode);

  const Icon = modeIcon[playMode];

  return (
    <Button
      className="border-none"
      onClick={cyclePlayMode}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      <Icon className="size-4" />
    </Button>
  );
}
