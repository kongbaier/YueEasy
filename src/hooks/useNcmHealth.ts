import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { setNcmPort } from "@/services/ncm";
import { useUiStore } from "@/stores";

export function useNcmHealth() {
  const setNcmReady = useUiStore((s) => s.setNcmReady);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;

    const poll = async () => {
      if (cancelled) return;
      const ok = await invoke<boolean>("ncm_health_check").catch(() => false);
      if (cancelled) return;

      if (ok) {
        const port = await invoke<number>("get_ncm_port").catch(() => 0);
        if (port > 0) {
          setNcmPort(port);
        }
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
