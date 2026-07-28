import { useAppSettings } from "@/stores/settings";
import { initAuth } from "@/stores/auth";

/**
 * Application-level initialization that must complete before React mounts.
 *
 * Only includes genuinely blocking infrastructure (theme, window effect, auth session).
 * Feature-level initialization lives in each module's store (self-subscribing pattern).
 */
export async function bootstrap() {
  await useAppSettings.getState().init();
  await initAuth();
}
