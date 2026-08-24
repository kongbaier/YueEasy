import { useSettingsStore } from '@/stores/settings';
import { useQueueStore } from '@/stores/queue';
import { usePlayerStore } from '@/stores/player';
import { initAuth } from '@/modules/auth/stores/authStore';

/**
 * Application-level initialization that must complete before React mounts.
 *
 * Only includes genuinely blocking infrastructure (theme, window effect, auth session).
 * Feature-level initialization lives in each module's store (self-subscribing pattern).
 */
export async function bootstrap() {
  await useSettingsStore.persist.rehydrate();
  await initAuth();
  applyPlayerSettings();
  await restorePlayerState();
}

/**
 * 启动下发音量/静音到 audioCore（前端权威仍在 settings + AudioCore）。
 */
function applyPlayerSettings(): void {
  const { volume, isMuted } = useSettingsStore.getState().player;
  usePlayerStore.getState().setVolume(isMuted ? 0 : volume);
}

/**
 * 启动恢复：rehydrate queue store（plugin-store 持久化）→ 从快照重建两条 policy 并回填（不自动播放）。
 * 队列持久化在低频的 useQueueStore（plugin-store），与 60fps transport 更新解耦。
 * 持久化 shape 即 QueueSnapshot；rehydrate 后字段在 store state（camelCase）。
 */
async function restorePlayerState(): Promise<void> {
  await useQueueStore.persist.rehydrate();
  const data = useQueueStore.getState() as any;
  usePlayerStore.getState().restore({
    contentSource: data.contentSource,
    queue: data.queue,
    currentIndex: data.currentIndex,
    order: data.order,
    repeat: data.repeat,
    fmQueue: data.fmQueue ?? [],
    fmIndex: data.fmIndex ?? null,
    fmRepeat: data.fmRepeat ?? "off",
    fmPlayedIds: data.fmPlayedIds ?? [],
  });
}
