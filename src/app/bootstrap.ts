import { useSettingsStore } from '@/stores/settings';
import { initAuth } from '@/stores/auth';
import { restorePlayerState } from '@/modules/player/services/PlayerService';

/**
 * Application-level initialization that must complete before React mounts.
 *
 * Only includes genuinely blocking infrastructure (theme, window effect, auth session).
 * Feature-level initialization lives in each module's store (self-subscribing pattern).
 */
export async function bootstrap() {
  await useSettingsStore.persist.rehydrate();
  await initAuth();
  // Phase F：从 Rust 拉取播放器快照恢复队列/进度（Rust 模式；TS 模式内部 no-op）
  await restorePlayerState();
}
