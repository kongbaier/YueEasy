import { invoke } from "@tauri-apps/api/core";

export function setNcmCookie(cookie: string) {
  return invoke("ncm_set_cookie", { cookie });
}

export function getNcmCookie(): Promise<string> {
  return invoke<string>("ncm_get_cookie");
}

export function clearNcmCookie(): Promise<void> {
  return invoke("ncm_clear_cookie");
}
