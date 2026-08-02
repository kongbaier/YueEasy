// NCM API Response: /login_cellphone
export interface LoginResponse {
  code: number;
  cookie: string;
  token: string;
  account?: {
    id: number;
    userName: string;
  };
  profile?: {
    userId: number;
    nickname: string;
    avatarUrl: string;
  };
}

// NCM API Response: /captcha_sent, /captcha_verify
export interface CaptchaResponse {
  code: number;
  data: boolean;
  message?: string;
}

// NCM API Response: /login_qr_key
export interface QrKeyResponse {
  code: number;
  unikey: string;
}

// NCM API Response: /login_qr_create
export interface QrCreateResponse {
  code: number;
  data: {
    qrurl: string;
    qrimg: string;
  };
}

// NCM API Response: /login_qr_check
export interface QrCheckResponse {
  code: number;
  message: string;
  cookie: string;
}

// NCM API Response: /login_status
export interface LoginStatusResponse {
  data: {
    code: number;
    profile?: {
      userId: number;
      nickname: string;
      avatarUrl: string;
    };
  };
}
