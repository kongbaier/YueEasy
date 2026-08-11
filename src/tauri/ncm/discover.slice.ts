import {
  ncmBanner,
  ncmFmTrash,
  ncmHomepageDragonBall,
  ncmPersonalFm,
  ncmPlaymodeIntelligenceList,
  ncmRecommendSongs,
} from './api';

export const discoverSlice = {
  banner: () => ncmBanner({ bannerType: 0 }),

  recommendSongs: () => ncmRecommendSongs(),

  personalFm: () => ncmPersonalFm(),

  fmTrash: (id: number) => ncmFmTrash({ id }),

  // 首页圆形入口（含"私人雷达"，登录后调用）
  dragonBall: () => ncmHomepageDragonBall(),

  // 心动模式/智能播放：基于当前播放的歌曲生成相似歌曲
  playmodeIntelligenceList: (id: number, pid: number, count = 20) =>
    ncmPlaymodeIntelligenceList({ id, pid, count }),
};
