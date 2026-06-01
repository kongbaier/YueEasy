import { useEffect, useRef, useState } from "react";
import { useNavigationType } from "react-router-dom";

export function useCanGoBack() {
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
