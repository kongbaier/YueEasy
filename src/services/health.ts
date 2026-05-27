import { invoke } from "@tauri-apps/api/core";

export async function checkNcmHealth(): Promise<boolean> {
  return invoke("ncm_health_check");
}
