import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useNavigationType } from "react-router-dom";
import { WindowControls } from "@/shared/ui/system";
import { usePageTitle } from "./PageTitleContext";

function useCanGoBack() {
  const navigationType = useNavigationType();
  const [canGoBack, setCanGoBack] = useState(false);
  const depthRef = useRef(0);

  useEffect(() => {
    if (navigationType === "PUSH") {
      depthRef.current += 1;
    } else if (navigationType === "POP" && depthRef.current > 0) {
      depthRef.current -= 1;
    }
    setCanGoBack(depthRef.current > 0);
  }, [navigationType]);

  return canGoBack;
}

export const AppHeader = () => {
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const { title } = usePageTitle();

  return (
    <header
      className="h-10 flex items-center shrink-0 select-none"
      data-tauri-drag-region
    >
      {canGoBack && (
        <button
          aria-label="返回"
          className="ml-2 p-1 rounded-md hover:bg-black/10 transition-colors"
          onClick={() => navigate(-1)}
          type="button"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      {title && (
        <nav className="ml-3 flex items-center gap-1.5 text-xs min-w-0">
          <span className="text-muted-foreground/60 font-medium">乐·易</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground/80 font-medium truncate">
            {title}
          </span>
        </nav>
      )}
      <WindowControls className="ml-auto mr-1" />
    </header>
  );
};
