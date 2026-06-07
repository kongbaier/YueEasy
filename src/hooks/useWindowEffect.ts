import type { Effect } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { getSetting, setWindowEffect } from "@/services/tauri";

export function useWindowEffect() {
  useEffect(() => {
    getSetting("window_effect")
      .then((effect) => {
        if (effect) {
          setWindowEffect(effect as Effect);
        }
      })
      .catch(() => {
        // setting not saved yet, use default (Mica in Rust)
      });
  }, []);
}
