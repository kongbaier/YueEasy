import { useSettingsStore } from "@/stores/settings";
import { initAuth } from "@/modules/auth/stores/authStore";
import { usePlayerStore } from "@/stores/player";
import {
  getFullPlayerState,
  getPosition,
  restorePlayback,
} from "@/tauri/player";

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
 * 音频迁移 Rust 后，音量/静音权威仍在前端 settings，需在启动时下发到 Rust 音频引擎。
 */
function applyPlayerSettings(): void {
  const { volume, isMuted } = useSettingsStore.getState().player;
  usePlayerStore.getState().setVolume(isMuted ? 0 : volume);
}

/**
 * 启动恢复：从 Rust 拉取全量快照填充 store，再由 Rust `restore_playback` 恢复
 * 音频播放（若上次播放中），最后拉取实际位置校准进度。
 */
async function restorePlayerState(): Promise<void> {
  try {
    const { snapshot, current_track } = await getFullPlayerState();
    usePlayerStore.setState({
      currentTrack: current_track,
      queue: snapshot.queue,
      currentIndex: snapshot.current_index,
      order: snapshot.order,
      repeat: snapshot.repeat,
      contentSource: snapshot.content_source,
    });

    if (current_track) {
      usePlayerStore.setState({
        duration: current_track.duration_secs,
        playing: snapshot.playing,
      });
    }

    await restorePlayback();

    const [pos, playing] = await getPosition();
    usePlayerStore.setState({
      currentTime: pos,
      currentTimeHigh: pos,
      playing,
    });
  } catch (err) {
    console.warn("[restorePlayerState] 恢复播放器状态失败（保持暂停）:", err);
  }
}
