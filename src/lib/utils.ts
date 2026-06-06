import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Append thumbnail param to NCM image URLs. Non-NCM URLs pass through unchanged. */
export function getNcmImageUrl(url: string | undefined, size: number): string {
  if (!url) return "";
  if (!url.includes("music.126.net")) return url;
  const base = url.split("?")[0];
  return `${base}?param=${size}y${size}`;
}
