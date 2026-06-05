import { ncm } from "./ncm";

export async function resolveUrl(id: number): Promise<string> {
  const result = await ncm.songUrl(id);
  const url = result.data?.[0]?.url || "";
  if (!url) {
    throw new Error("无法解析播放地址");
  }
  return url;
}
