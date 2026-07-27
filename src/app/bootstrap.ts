import { initAuth, initLikes } from "@/features/auth/init";
import { initPlayer, initQueuePersistence } from "@/features/player/init";
import { setWindowEffect } from "@/shared/services/effect";
import { useAppSettings } from "@/stores/settings";

/**
 * Pre-React initialization. Calls feature-owned init functions in order.
 * No React dependency, no DOM manipulation.
 */
export async function bootstrap() {
  // Settings must load first (other inits may read from store)
  await useAppSettings.getState().init();

  // Apply window effect from persisted settings
  await setWindowEffect(useAppSettings.getState().settings.window_effect);

  // Auth must resolve before likes (likes depends on userId)
  await initAuth();
  initLikes();

  // Player restore + queue persistence (independent of auth)
  initPlayer();
  initQueuePersistence();
}
