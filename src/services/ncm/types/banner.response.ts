// NCM API Response: /banner
export interface Banner {
  bigImageUrl: string;
  imageUrl: string;
  s_ctrp: string;
  targetId: number;
  targetType: number;
  titleColor: string;
  typeTitle: string;
  url: string;
}

export interface BannerResponse {
  code: number;
  banners: Banner[];
}
