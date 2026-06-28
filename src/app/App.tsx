import { AppRouter } from "@/app/router";
import { useAccentColor } from "@/shared/hooks/useAccentColor";
import { useThemeSync } from "@/shared/hooks/useThemeSync";
import { useWindowDrag } from "@/shared/hooks/useWindowDrag";
import { useWindowEffect } from "@/shared/hooks/useWindowEffect";
import "../styles/index.css";
import { Toaster } from "sonner";
import { Providers } from "./providers";

export default function App() {
  useThemeSync();
  useAccentColor();
  useWindowDrag("drag-region");
  useWindowEffect();
  return (
    <Providers>
      <AppRouter />
      <Toaster position="top-right" richColors style={{ top: "2.5rem" }} />
    </Providers>
  );
}
