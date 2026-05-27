import type { Playlist, Track } from "@/types/music";
import type { LoginResponse } from "@/types/user";

let ncmPort = 0;

let resolvePort: (() => void) | null = null;
const portReady = new Promise<void>((resolve) => {
  resolvePort = resolve;
});

export function setNcmPort(port: number) {
  console.log(`NCM API port set to ${port}`);
  ncmPort = port;
  resolvePort?.();
}

function baseUrl(): string {
  return `http://127.0.0.1:${ncmPort}`;
}
let cookie = "";

export function setNcmCookie(c: string) {
  cookie = c;
}

export function getNcmCookie(): string {
  return cookie;
}

class NcmError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`NCM API error: ${status}`);
  }
}

async function ncmGet<T>(
  endpoint: string,
  params?: Record<string, string>,
): Promise<T> {
  if (ncmPort === 0) await portReady;
  const url = new URL(`${baseUrl()}${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  if (cookie) {
    url.searchParams.set("cookie", cookie);
  }
  const res = await fetch(url.toString());
  if (!res.ok)
    throw new NcmError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

async function ncmPost<T>(
  endpoint: string,
  body?: Record<string, unknown>,
): Promise<T> {
  if (ncmPort === 0) await portReady;
  const url = new URL(`${baseUrl()}${endpoint}`);
  if (cookie) {
    url.searchParams.set("cookie", cookie);
  }
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok)
    throw new NcmError(res.status, await res.json().catch(() => ({})));
  return res.json();
}

export const ncm = {
  search: (keywords: string, limit = 30, offset = 0) =>
    ncmGet<{ result: { songs: Track[]; songCount: number } }>("/cloudsearch", {
      keywords,
      type: "1",
      limit: String(limit),
      offset: String(offset),
    }),

  songUrl: (id: number) =>
    ncmGet<{ data: { url: string; type: string; id: number }[] }>(
      "/song/url/v1",
      {
        id: String(id),
        level: "standard",
      },
    ),

  songDetail: (ids: number[]) =>
    ncmGet<{ songs: Track[] }>("/song/detail", {
      ids: ids.join(","),
    }),

  lyric: (id: number) =>
    ncmGet<{ lrc?: { lyric: string }; tlyric?: { lyric: string } }>("/lyric", {
      id: String(id),
    }),

  playlistDetail: (id: number) =>
    ncmGet<{ playlist: Playlist }>("/playlist/detail", {
      id: String(id),
    }),

  userPlaylist: (uid: number) =>
    ncmGet<{ playlist: Playlist[] }>("/user/playlist", {
      uid: String(uid),
    }),

  loginCellphone: (phone: string, password: string) =>
    ncmPost<LoginResponse>("/login/cellphone", { phone, password }),

  loginStatus: () =>
    ncmPost<{
      data: {
        code: number;
        profile?: { userId: number; nickname: string; avatarUrl: string };
      };
    }>("/login/status"),

  recommendSongs: () =>
    ncmGet<{ data: { dailySongs: Track[] } }>("/recommend/songs"),

  personalizedPlaylist: (limit = 30) =>
    ncmGet<{ result: Playlist[] }>("/personalized", { limit: String(limit) }),

  banner: () =>
    ncmGet<{
      banners: {
        imageUrl: string;
        targetId: number;
        titleColor: string;
        typeTitle: string;
      }[];
    }>("/banner", { type: "0" }),

  topPlaylist: (cat = "全部", limit = 30, offset = 0) =>
    ncmGet<{ playlists: Playlist[] }>("/top/playlist", {
      cat,
      limit: String(limit),
      offset: String(offset),
    }),
};
