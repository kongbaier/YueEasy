import { invoke } from "@tauri-apps/api/core";

export async function getSetting(key: string): Promise<string> {
  return invoke("get_setting", { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke("set_setting", { key, value });
}

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
  // biome-ignore lint/suspicious/noExplicitAny: Tauri IPC typing
  const raw = await invoke<any[]>("history_get", { limit, offset });
  return raw.map((r) => ({
    ...r,
    synced: Boolean(r.synced),
  }));
}

export async function historyMarkSynced(ids: number[]): Promise<void> {
  return invoke("history_mark_synced", { ids });
}

export {
  CacheKeys,
  cacheClearPrefix,
  cacheDelete,
  cacheGet,
  cacheSet,
} from "./cache";
