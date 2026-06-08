import { useEffect } from "react";
import { toast } from "sonner";
import { getSetting, setWindowEffect } from "@/services/tauri";

export function useWindowEffect() {
  useEffect(() => {
    getSetting("window_effect")
      .then((effect) => {
        if (effect) {
          return setWindowEffect(effect);
        }
      })
      .catch(() => {
        toast.error("Failed to apply window effect");
      });
  }, []);
}
