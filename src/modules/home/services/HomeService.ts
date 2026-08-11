import type {
  Banner,
  DragonBallItem,
  Playlist,
  Song,
} from "@/shared/types/entities";
import { BannerType } from "@/shared/types/entities";
import { ncm } from "@/tauri/ncm";
import { CacheKeys, cachedFetch } from "@/tauri/cache";

export const homeService = {
  /** 首页 banner（过滤广告） */
  banner: async (): Promise<Banner[]> => {
    const r = await cachedFetch(CacheKeys.banner, () => ncm.banner());
    return r.data.filter((banner) => banner.targetType !== BannerType.AD);
  },

  /** 推荐歌单 */
  personalized: async (limit = 20): Promise<Playlist[]> => {
    const r = await cachedFetch(CacheKeys.personalized, () =>
      ncm.personalizedPlaylist(limit),
    );
    return r.data;
  },

  /** 热门歌单 */
  topPlaylists: async (cat = "全部", limit = 20): Promise<Playlist[]> => {
    const r = await cachedFetch(CacheKeys.topPlaylists(cat), () =>
      ncm.topPlaylist(cat, limit),
    );
    return r.data.playlists;
  },

  /** 私人漫游候选歌（FmCard 预请求） */
  personalFmPreview: async (): Promise<Song[]> => ncm.personalFm(),

  /** 首页圆形入口（RadarCard） */
  dragonBall: async (): Promise<DragonBallItem[]> => ncm.dragonBall(),

  /** 圆形入口对应歌单详情（RadarCard 取真实封面） */
  playlistDetail: async (id: number): Promise<Playlist> =>
    ncm.playlistDetail(id),
};

