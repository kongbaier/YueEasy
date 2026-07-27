import { Store } from "@tauri-apps/plugin-store";

export const store = await Store.load("settings.json", {
  defaults: {},
  autoSave: 300,
});

export async function loadAllEntries<T = unknown>(): Promise<Partial<T>> {
  const entries = await store.entries();
  return Object.fromEntries(entries) as Partial<T>;
}

export async function getStoreValue<T = unknown>(
  key: string,
): Promise<T | undefined> {
  return store.get<T>(key);
}

export async function setStoreValue(
  key: string,
  value: unknown,
): Promise<void> {
  await store.set(key, value);
}
