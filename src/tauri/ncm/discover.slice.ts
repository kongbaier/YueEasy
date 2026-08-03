import {
  ncmBanner,
  ncmFmTrash,
  ncmHomepageDragonBall,
  ncmPersonalFm,
  ncmPlaymodeIntelligenceList,
  ncmRecommendSongs,
} from './api';
import type {
  BannerResponse,
  DragonBallResponse,
  FmTrashResponse,
  IntelligenceListResponse,
  PersonalFmResponse,
  RecommendSongsResponse,
} from './types';

export type {
  BannerResponse,
  DragonBallResponse,
  FmTrashResponse,
  IntelligenceListResponse,
  PersonalFmResponse,
  RecommendSongsResponse,
} from './types';

export const discoverSlice = {
  banner: () => ncmBanner<BannerResponse>({ bannerType: 0 }),

  recommendSongs: () => ncmRecommendSongs<RecommendSongsResponse>(),

  personalFm: () => ncmPersonalFm<PersonalFmResponse>(),

  fmTrash: (id: number) => ncmFmTrash<FmTrashResponse>({ id }),

  // 首页圆形入口（含"私人雷达"，登录后调用）
  dragonBall: () => ncmHomepageDragonBall<DragonBallResponse>(),

  // 心动模式/智能播放：基于当前播放的歌曲生成相似歌曲
  playmodeIntelligenceList: (id: number, pid: number, count = 20) =>
    ncmPlaymodeIntelligenceList<IntelligenceListResponse>({ id, pid, count }),
};
