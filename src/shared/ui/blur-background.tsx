import { useEffect, useRef } from 'react';

interface BlurBackgroundProps {
  src: string | undefined;
  className?: string;
  style?: React.CSSProperties;
}

export function BlurBackground({ src, className, style }: BlurBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.addEventListener('load', () => {
      if (cancelled) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    });
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!src) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ imageRendering: 'auto', ...style }}
    />
  );
}
