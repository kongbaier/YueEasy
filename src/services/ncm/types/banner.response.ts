// NCM API Response: /banner
export interface Banner {
  // 宽高比为 9:5的图片 URL，适用于大屏幕
  bigImageUrl: string;
  // 宽高比为 27:10的图片 URL，适用于小屏幕
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
