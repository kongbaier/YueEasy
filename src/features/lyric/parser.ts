export interface WordTiming {
  startMs: number;
  durationMs: number;
  text: string;
}

export interface LyricLine {
  startMs: number;
  durationMs: number;
  text: string;
  words?: WordTiming[];
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

    for (const startMs of timestamps) {
      lines.push({ startMs, durationMs: 0, text });
    }
  }

  lines.sort((a, b) => a.startMs - b.startMs);
  fillDurations(lines);
  return lines;
}

/**
 * Parse YRC (word-level / 逐字) lyrics format.
 *
 * Format: [lineStartMs,lineDurationMs](wordAbsStartMs,wordDurationMs,flag)char...
 * Word timestamps are absolute; they get converted to line-relative in output.
 * Lines starting with `{` are JSON metadata and are skipped.
 */
export function parseYrc(content: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const LINE_RE = /^\[(\d+),(\d+)\]/;

  for (const raw of content.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("{")) continue;

    const lineMatch = LINE_RE.exec(trimmed);
    if (!lineMatch) continue;

    const lineStartMs = Number.parseInt(lineMatch[1], 10);
    const lineDurationMs = Number.parseInt(lineMatch[2], 10);

    // Text after the line header [start,duration]
    const afterHeader = trimmed.slice(lineMatch[0].length);

    // Per-character timings: (absStart,duration,flag)char...
    const WORD_RE = /\((\d+),(\d+),\d+\)/g;
    const words: WordTiming[] = [];

    let wordMatch = WORD_RE.exec(afterHeader);
    while (wordMatch) {
      const textStart = wordMatch.index + wordMatch[0].length;
      const wordAbsStartMs = Number.parseInt(wordMatch[1], 10);
      const wordDurationMs = Number.parseInt(wordMatch[2], 10);

      // Text between this timing marker and the next (or end of line)
      WORD_RE.lastIndex = textStart;
      const nextMatch = WORD_RE.exec(afterHeader);
      const textEnd = nextMatch ? nextMatch.index : afterHeader.length;
      const text = afterHeader.slice(textStart, textEnd);

      if (text) {
        words.push({
          startMs: wordAbsStartMs - lineStartMs,
          durationMs: wordDurationMs,
          text,
        });
      }

      WORD_RE.lastIndex = textEnd;
      wordMatch = WORD_RE.exec(afterHeader);
    }

    const fullText =
      words.length > 0 ? words.map((w) => w.text).join("") : afterHeader;

    lines.push({
      startMs: lineStartMs,
      durationMs: lineDurationMs,
      text: fullText,
      words: words.length > 0 ? words : undefined,
    });
  }

  lines.sort((a, b) => a.startMs - b.startMs);
  return lines;
}
