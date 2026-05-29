export interface LyricLine {
  startMs: number;
  durationMs: number;
  text: string;
}

const TIMESTAMP_RE = /\[(\d{1,3}):(\d{2})(?:[.:](\d{2,3}))?\]/g;

function isMetadataTag(text: string): boolean {
  return /^\[[a-z]+:/.test(text);
}

function fillDurations(lines: LyricLine[]): void {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].durationMs > 0) continue;
    if (i + 1 < lines.length) {
      lines[i].durationMs = lines[i + 1].startMs - lines[i].startMs;
    } else {
      lines[i].durationMs = 5000;
    }
  }
}

export function parseLrc(content: string): LyricLine[] {
  const lines: LyricLine[] = [];

  for (const raw of content.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || isMetadataTag(trimmed)) continue;

    TIMESTAMP_RE.lastIndex = 0;
    const timestamps: number[] = [];
    let match = TIMESTAMP_RE.exec(trimmed);

    while (match) {
      const minutes = Number.parseInt(match[1], 10);
      const seconds = Number.parseInt(match[2], 10);
      const frac = match[3] ? Number.parseInt(match[3], 10) : 0;
      const ms =
        minutes * 60 * 1000 +
        seconds * 1000 +
        frac * (match[3]?.length === 2 ? 10 : 1);
      timestamps.push(ms);
      match = TIMESTAMP_RE.exec(trimmed);
    }

    if (timestamps.length === 0) continue;

    const text = trimmed.replace(TIMESTAMP_RE, "").trim();
    if (!text) continue;

    for (const startMs of timestamps) {
      lines.push({ startMs, durationMs: 0, text });
    }
  }

  lines.sort((a, b) => a.startMs - b.startMs);
  fillDurations(lines);
  return lines;
}
