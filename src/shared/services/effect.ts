import type { Effect } from "@tauri-apps/api/window";
import { EffectState, getCurrentWindow } from "@tauri-apps/api/window";

export async function setWindowEffect(effect: Effect): Promise<void> {
  const window = getCurrentWindow();

  await window.setEffects({
    effects: [effect],
    state: EffectState.FollowsWindowActiveState,
  });
}
