import { EffectState, getCurrentWindow } from '@tauri-apps/api/window';
import type { Effect as TauriEffect } from '@tauri-apps/api/window';
// 领域类型/枚举下沉到 shared/types/effect（值即 Tauri wire 值），infra 从这里取用。
import { Effect, type WindowsEffect } from '@/shared/types/effect';

async function setWindowEffect(effect: WindowsEffect): Promise<void> {
  const window = getCurrentWindow();
  await window.setEffects({
    // WindowsEffect 与 Tauri Effect 枚举 wire 值同构，仅类型收窄即可透传
    effects: [effect as TauriEffect],
    state: EffectState.FollowsWindowActiveState,
  });
}

export const setWindowsEffect = async (
  effect: WindowsEffect,
): Promise<void> => {
  await setWindowEffect(effect);
};

// infra 对外再导出领域类型，保留旧 import 面（@/tauri/effect 的 Effect / WindowsEffect）。
export { Effect, type WindowsEffect };
