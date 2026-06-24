import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateInfo {
  currentVersion: string;
  newVersion: string;
  body?: string;
  date?: string;
}

/** 检查是否有可用更新，返回更新信息或 null */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const update = await check();
  if (!update) return null;
  return {
    currentVersion: update.currentVersion,
    newVersion: update.version,
    body: update.body,
    date: update.date,
  };
}

interface DownloadProgress {
  event: string;
  downloaded?: number;
  contentLength?: number | null;
}

/** 下载并安装更新，onProgress 回调接收 (downloaded, total) */
export async function downloadAndInstall(
  onProgress?: (downloaded: number, total: number | null) => void,
): Promise<void> {
  const update = await check();
  if (!update) throw new Error("No update available");

  await update.downloadAndInstall((status: DownloadProgress) => {
    if (
      onProgress &&
      status.event === "Progress" &&
      typeof status.downloaded === "number"
    ) {
      onProgress(status.downloaded, status.contentLength ?? null);
    }
  });
}

/** 安装完成后重启应用（作为兜底，通常安装器会自动重启） */
export async function installAndRelaunch(): Promise<void> {
  await relaunch();
}
