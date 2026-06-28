import { invoke } from "@tauri-apps/api/core";

export interface SmtcMetadata {
  title: string;
  artist: string;
  album: string;
  durationSecs: number;
  artworkUrl?: string;
}

export async function initSmtc(): Promise<void> {
  return invoke("init_smtc");
}

export async function updateSmtcMetadata(meta: SmtcMetadata): Promise<void> {
  return invoke("update_smtc_metadata", { meta });
}

export async function updateSmtcStatus(playing: boolean): Promise<void> {
  return invoke("update_smtc_status", { playing });
}

export async function updateSmtcPosition(positionSecs: number): Promise<void> {
  return invoke("update_smtc_position", { positionSecs });
}
