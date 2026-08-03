import {
  ncmCaptchaSent,
  ncmCaptchaVerify,
  ncmLoginCellphone,
  ncmLoginQrCheck,
  ncmLoginQrCreate,
  ncmLoginQrKey,
  ncmLoginStatus,
} from './api';
import type {
  CaptchaResponse,
  LoginResponse,
  LoginStatusResponse,
  QrCheckResponse,
  QrCreateResponse,
  QrKeyResponse,
} from './types';

export type {
  CaptchaResponse,
  LoginResponse,
  LoginStatusResponse,
  QrCheckResponse,
  QrCreateResponse,
  QrKeyResponse,
} from './types';

export const authSlice = {
  loginCellphone: (
    params: { phone: string } & ({ password: string } | { captcha: string }),
  ) => ncmLoginCellphone<LoginResponse>(params),

  captchaSent: (phone: string) =>
    ncmCaptchaSent<CaptchaResponse>({ phone }),

  captchaVerify: (phone: string, captcha: string) =>
    ncmCaptchaVerify<CaptchaResponse>({ phone, captcha }),

  qrKey: () => ncmLoginQrKey<QrKeyResponse>(),

  qrCreate: (key: string) =>
    ncmLoginQrCreate<QrCreateResponse>({ key, qrimg: 'true' }),

  qrCheck: (key: string) => ncmLoginQrCheck<QrCheckResponse>({ key }),

  loginStatus: () => ncmLoginStatus<LoginStatusResponse>(),
};
