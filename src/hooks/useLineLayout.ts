import type { LayoutLinesResult } from "@chenglou/pretext";
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import { useEffect, useState } from "react";

export function useLineLayout(
  text: string,
  contentWidth: number | undefined,
  font: string,
  lineHeight: number,
): LayoutLinesResult | null {
  const [result, setResult] = useState<LayoutLinesResult | null>(null);

  useEffect(() => {
    if (!contentWidth) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      const prepared = prepareWithSegments(text, font);
      const lines = layoutWithLines(prepared, contentWidth, lineHeight);
      setResult(lines);
    });
    return () => {
      cancelled = true;
    };
  }, [contentWidth, text, font, lineHeight]);

  return result;
}
