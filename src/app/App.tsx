import { AppRouter } from "@/app/Router";
import { useAccentColor } from "@/shared/hooks/useAccentColor";
import { useThemeSync } from "@/shared/hooks/useThemeSync";
import { useWindowDrag } from "@/shared/hooks/useWindowDrag";
import "../styles/index.css";
import { Toaster } from "sonner";
import { Providers } from "./Providers";

export default function App() {
  useThemeSync();
  useAccentColor();
  useWindowDrag("drag-region");
  return (
    <Providers>
      <AppRouter />
      <Toaster position="top-right" richColors style={{ top: "2.5rem" }} />
    </Providers>
  );
}
