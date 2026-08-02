import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export { type Update };

/** 检查是否有可用更新，返回 Update 对象或 null */
export async function checkForUpdate(): Promise<Update | null> {
  return check();
}

/** 下载并安装更新，onProgress 回调接收 (downloaded, total) */
export async function downloadAndInstall(
  update: Update,
  onProgress?: (downloaded: number, total: number | null) => void,
): Promise<void> {
  let downloaded = 0;
  let contentLength: number | null = null;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        contentLength = event.data.contentLength ?? null;
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress?.(downloaded, contentLength);
        break;
    }
  });
}

/** 安装完成后重启应用（作为兜底，通常安装器会自动重启） */
export async function installAndRelaunch(): Promise<void> {
  await relaunch();
}
