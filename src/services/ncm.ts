import { invoke } from "@tauri-apps/api/core";
import type { Playlist, Track } from "@/types/music";
import type { LoginResponse } from "@/types/user";

async function ncmApi<T>(
  method: string,
  params?: Record<string, string>,
): Promise<T> {
  const body = await invoke<unknown>("ncm_request", {
    method,
    params: params ?? {},
  });
  return body as T;
}

export function setNcmCookie(cookie: string) {
  return invoke("ncm_set_cookie", { cookie });
}

export function getNcmCookie(): Promise<string> {
  return invoke<string>("ncm_get_cookie");
}

export function clearNcmCookie(): Promise<void> {
  return invoke("ncm_clear_cookie");
}

export const ncm = {
  search: (keywords: string, limit = 30, offset = 0) =>
    ncmApi<{ result: { songs: Track[]; songCount: number } }>("cloudsearch", {
      keywords,
      type: "1",
      limit: String(limit),
      offset: String(offset),
    }),

  songUrl: (id: number) =>
    ncmApi<{ data: { url: string; type: string; id: number }[] }>(
      "song_url_v1",
      { id: String(id), level: "standard" },
    ),

  songDetail: (ids: number[]) =>
    ncmApi<{ songs: Track[] }>("song_detail", { ids: ids.join(",") }),

  lyric: (id: number) =>
    ncmApi<{ lrc?: { lyric: string }; tlyric?: { lyric: string } }>("lyric", {
      id: String(id),
    }),

  playlistDetail: (id: number) =>
    ncmApi<{ playlist: Playlist }>("playlist_detail", { id: String(id) }),

  userPlaylist: (uid: number) =>
    ncmApi<{ playlist: Playlist[] }>("user_playlist", { uid: String(uid) }),

  loginCellphone: (phone: string, captcha: string) =>
    ncmApi<LoginResponse>("login_cellphone", { phone, captcha }),

  captchaSent: (phone: string) =>
    ncmApi<{ code: number; data: boolean; message?: string }>("captcha_sent", {
      phone,
    }),

  captchaVerify: (phone: string, captcha: string) =>
    ncmApi<{ code: number; data: boolean; message?: string }>(
      "captcha_verify",
      { phone, captcha },
    ),

  qrKey: () => ncmApi<{ code: number; unikey: string }>("login_qr_key"),

  qrCreate: (key: string) =>
    ncmApi<{ code: number; data: { qrurl: string; qrimg: string } }>(
      "login_qr_create",
      { key, qrimg: "true" },
    ),

  qrCheck: (key: string) =>
    ncmApi<{ code: number; message: string; cookie: string }>(
      "login_qr_check",
      { key },
    ),

  loginStatus: () =>
    ncmApi<{
      data: {
        code: number;
        profile?: { userId: number; nickname: string; avatarUrl: string };
      };
    }>("login_status"),

  recommendSongs: () =>
    ncmApi<{ data: { dailySongs: Track[] } }>("recommend_songs"),

  personalizedPlaylist: (limit = 30) =>
    ncmApi<{ result: Playlist[] }>("personalized", { limit: String(limit) }),

  banner: () =>
    ncmApi<{
      banners: {
        imageUrl: string;
        targetId: number;
        titleColor: string;
        typeTitle: string;
      }[];
    }>("banner", { type: "0" }),

  topPlaylist: (cat = "全部", limit = 30, offset = 0) =>
    ncmApi<{ playlists: Playlist[] }>("top_playlist", {
      cat,
      limit: String(limit),
      offset: String(offset),
    }),
};
