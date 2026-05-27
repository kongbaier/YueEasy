import { useEffect } from "react";
import { checkNcmHealth } from "@/services/health";
import { useUiStore } from "@/stores";

export function useNcmHealth() {
  const setNcmReady = useUiStore((s) => s.setNcmReady);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;

    const poll = async () => {
      if (cancelled) return;
      const ok = await checkNcmHealth().catch(() => false);
      if (cancelled) return;

      if (ok) {
        setNcmReady(true);
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 500);
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [setNcmReady]);
}
