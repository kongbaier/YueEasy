import { invoke } from "@tauri-apps/api/core";

export async function ncmApi<T>(
  method: string,
  params?: Record<string, string>,
): Promise<T> {
  const body = await invoke<unknown>("ncm_request", {
    method,
    params: params ?? {},
  });
  return body as T;
}
