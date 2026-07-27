import { invoke } from "@tauri-apps/api/core";

export async function downloadSong(
  songId: number,
  url: string,
): Promise<string> {
  return invoke("download_song", { songId, url });
}

export interface PlayRecord {
  id: number;
  song_id: number;
  song_name: string;
  artist: string;
  synced: boolean;
  played_at: string;
}

export async function historyAdd(
  songId: number,
  songName: string,
  artist: string,
): Promise<void> {
  return invoke("history_add", { songId, songName, artist });
}

export async function historyGet(
  limit: number,
  offset: number,
): Promise<PlayRecord[]> {
  // oxlint-disable-next-line typescript/no-explicit-any
  const raw = await invoke<any[]>("history_get", { limit, offset });
  return raw.map((r) => ({
    ...r,
    synced: Boolean(r.synced),
  }));
}

export async function historyMarkSynced(ids: number[]): Promise<void> {
  return invoke("history_mark_synced", { ids });
}
