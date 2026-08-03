import { BannerType, ncm, toFmSong } from '@/tauri/ncm';
import { CacheKeys, cachedFetch } from '@/tauri/cache';
import { toPlaylistDisplay } from '@/shared/utils/playlistMappers';

export const homeService = {
  /** 首页 banner（过滤广告） */
  banner: async () => {
    const r = await cachedFetch(CacheKeys.banner, () => ncm.banner());
    return r.data.banners.filter((banner) => banner.targetType !== BannerType.AD);
  },

  /** 推荐歌单 */
  personalized: async (limit = 20) => {
    const r = await cachedFetch(CacheKeys.personalized, () =>
      ncm.personalizedPlaylist(limit),
    );
    return r.data.result.map(toPlaylistDisplay);
  },

  /** 热门歌单 */
  topPlaylists: async (cat = '全部', limit = 20) => {
    const r = await cachedFetch(CacheKeys.topPlaylists(cat), () =>
      ncm.topPlaylist(cat, limit),
    );
    return r.data.playlists.map(toPlaylistDisplay);
  },

  /** 私人漫游候选歌（FmCard 预请求） */
  personalFmPreview: async () => {
    const r = await ncm.personalFm();
    return (r.data ?? []).map(toFmSong);
  },

  /** 首页圆形入口（RadarCard） */
  dragonBall: async () => {
    const r = await ncm.dragonBall();
    return r.data ?? [];
  },

  /** 圆形入口对应歌单详情（RadarCard 取真实封面） */
  playlistDetail: async (id: number) => {
    const r = await ncm.playlistDetail(id);
    return r;
  },
};
