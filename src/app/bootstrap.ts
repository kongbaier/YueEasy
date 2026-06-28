import { initAuth, initLikes } from "@/features/auth/init";
import { initPlayer, initQueuePersistence } from "@/features/player/init";

/**
 * Pre-React initialization. Calls feature-owned init functions in order.
 * No React dependency, no DOM manipulation.
 */
export async function bootstrap() {
  // Auth must resolve before likes (likes depends on userId)
  await initAuth();
  initLikes();

  // Player restore + queue persistence (independent of auth)
  initPlayer();
  initQueuePersistence();
}
