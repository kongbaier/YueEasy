export interface LoginRequest {
  phone?: string;
  password?: string;
  md5_password?: string;
}

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

export interface AuthState {
  isLoggedIn: boolean;
  cookie: string;
  userId: number | null;
  nickname: string;
  avatarUrl: string;
}
