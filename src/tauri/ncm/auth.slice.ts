import {
  ncmCaptchaSent,
  ncmCaptchaVerify,
  ncmLoginCellphone,
  ncmLoginQrCheck,
  ncmLoginQrCreate,
  ncmLoginQrKey,
  ncmLoginStatus,
} from './api';

export const authSlice = {
  loginCellphone: (
    params: { phone: string } & ({ password: string } | { captcha: string }),
  ) => ncmLoginCellphone(params),

  captchaSent: (phone: string) => ncmCaptchaSent({ phone }),

  captchaVerify: (phone: string, captcha: string) =>
    ncmCaptchaVerify({ phone, captcha }),

  qrKey: () => ncmLoginQrKey(),

  qrCreate: (key: string) => ncmLoginQrCreate({ key, qrimg: 'true' }),

  qrCheck: (key: string) => ncmLoginQrCheck({ key }),

  loginStatus: () => ncmLoginStatus(),
};
