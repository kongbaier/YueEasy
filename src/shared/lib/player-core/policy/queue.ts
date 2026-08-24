import { Track } from "../models/track";
import type { IPlaybackPolicy } from "../types";

export class QueuePolicy implements IPlaybackPolicy {
  next(): Track | null {}
}
