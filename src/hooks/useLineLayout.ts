import type { LayoutLinesResult } from "@chenglou/pretext";
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import { useEffect, useState } from "react";

const ACTIVE_FONT = "18px system-ui";
const LINE_HEIGHT = 24;

export function useLineLayout(
  text: string,
  contentWidth: number | undefined,
): LayoutLinesResult | null {
  const [result, setResult] = useState<LayoutLinesResult | null>(null);

  useEffect(() => {
    if (!contentWidth) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      const prepared = prepareWithSegments(text, ACTIVE_FONT);
      const lines = layoutWithLines(prepared, contentWidth, LINE_HEIGHT);
      setResult(lines);
    });
    return () => {
      cancelled = true;
    };
  }, [contentWidth, text]);

  return result;
}
