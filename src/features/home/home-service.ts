import { BannerType } from '@/shared/types/uiModels';
import { ncm } from '@/tauri';

export const getBanners = async () => {
  const r = await ncm.banner();
  return r.filter((banner) => banner.targetType !== BannerType.AD);
};

export const getPersonalized = (limit = 20) => {
  return ncm.personalized(limit);
};

export const getPersonalFmPreview = () => {
  return ncm.personalFm();
};

export const getTopPlaylists = async (cat = '全部', limit = 20) => {
  const res = await ncm.topPlaylist(cat, limit);
  return res.playlists;
};

export const getDragonBall = () => {
  return ncm.dragonBall();
};

export const getPlaylistDetail = (id: number | null) => {
  if (id === null) return null;
  return ncm.playlistDetail(id);
};
