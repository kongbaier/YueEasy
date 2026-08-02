import { Store } from '@tauri-apps/plugin-store';

const store = await Store.load('settings.json', {
  defaults: {},
  autoSave: 300,
});

export const TauriStorage = {
  getItem: async (name: string) => {
    const result = await store.get<string>(name);
    return result ?? null;
  },

  setItem: async (name: string, value: string) => {
    await store.set(name, value);
    await store.save();
  },
  removeItem: async (name: string) => {
    await store.delete(name);
  },
};
