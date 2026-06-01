import { ncmApi } from "./api";
import type {
  BannerResponse,
  PersonalFmResponse,
  RecommendSongsResponse,
} from "./types";

export type {
  BannerResponse,
  PersonalFmResponse,
  RecommendSongsResponse,
} from "./types";

export const discoverSlice = {
  banner: () => ncmApi<BannerResponse>("banner", { type: "0" }),

  recommendSongs: () => ncmApi<RecommendSongsResponse>("recommend_songs"),

  personalFm: () => ncmApi<PersonalFmResponse>("personal_fm"),
};
