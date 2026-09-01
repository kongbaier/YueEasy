// SettingsService —— 设置持久化编排（跨域共享服务）。
//
// 双 store（appSettingsStore / playerSettingsStore）只持运行时状态、不挂 persist 中间件；
// 本服务独占磁盘读写：load() 从 settings.json 的 'settings' key 读出历史持久化并播种两个 store
// （merge 默认值、缺字段兜底），随后订阅两 store 变更自动回写合并形状。
// 磁盘 key 与数据形状不变（zustand persist 包裹格式 { state: { appearance, player } }）→ 现有用户零迁移。
//
// 依赖方向：service → stores / infra（TauriStorage）；双 store 互不引用。

import { useAppSettingsStore } from "@/stores/appSettingsStore";
import { usePlayerSettingsStore } from "@/modules/player/stores/playerSettingsStore";
import { DEFAULTS_APPEARANCE } from "@/shared/constants/settings";
import { DEFAULTS_PLAYER } from "@/shared/constants/player";
import type {
  AppearanceSettings,
  PlayerSettings,
} from "@/shared/types/settings";
import { TauriStorage } from "@/tauri/storage";

/** 持久化 key（沿用旧 persist name，形状不变 → 免迁移）。 */
const KEY = "settings";

/** zustand persist 包裹格式（历史数据可能无 state 壳，兼容两种）。 */
interface PersistedSettings {
  state?: {
    appearance?: Partial<AppearanceSettings>;
    player?: Partial<PlayerSettings>;
  };
  appearance?: Partial<AppearanceSettings>;
  player?: Partial<PlayerSettings>;
}

/** 是否已完成启动播种；未 ready 前的变更不写盘（避免覆盖磁盘旧值）。 */
let ready = false;

async function save(): Promise<void> {
  if (!ready) return;
  const { appearance } = useAppSettingsStore.getState();
  const { player } = usePlayerSettingsStore.getState();
  await TauriStorage.setItem(
    KEY,
    JSON.stringify({ state: { appearance, player }, version: 0 }),
  );
}

/** 启动加载：读盘 → 播种两 store（merge 默认值，缺字段兜底）。 */
async function load(): Promise<void> {
  let state: Pick<PersistedSettings, "appearance" | "player"> = {};
  const raw = await TauriStorage.getItem(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PersistedSettings;
      state = parsed.state ?? parsed;
    } catch {
      state = {};
    }
  }
  useAppSettingsStore.setState({
    appearance: { ...DEFAULTS_APPEARANCE, ...state.appearance },
  });
  usePlayerSettingsStore.setState({
    player: { ...DEFAULTS_PLAYER, ...state.player },
  });
  ready = true;
}

export const settingsService = {
  load,
  save,
};

// 模块加载即订阅双 store 变更自动回写（ready 前 no-op，避免播种覆盖磁盘）。
useAppSettingsStore.subscribe(() => {
  void save();
});
usePlayerSettingsStore.subscribe(() => {
  void save();
});
