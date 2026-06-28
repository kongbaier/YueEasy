import { ncmApi } from "./api";
import type {
  CaptchaResponse,
  LoginResponse,
  LoginStatusResponse,
  QrCheckResponse,
  QrCreateResponse,
  QrKeyResponse,
} from "./types";

export type {
  CaptchaResponse,
  LoginResponse,
  LoginStatusResponse,
  QrCheckResponse,
  QrCreateResponse,
  QrKeyResponse,
} from "./types";

export const authSlice = {
  loginCellphone: (
    params: { phone: string } & ({ password: string } | { captcha: string }),
  ) => ncmApi<LoginResponse>("login_cellphone", params),

  captchaSent: (phone: string) =>
    ncmApi<CaptchaResponse>("captcha_sent", { phone }),

  captchaVerify: (phone: string, captcha: string) =>
    ncmApi<CaptchaResponse>("captcha_verify", { phone, captcha }),

  qrKey: () => ncmApi<QrKeyResponse>("login_qr_key"),

  qrCreate: (key: string) =>
    ncmApi<QrCreateResponse>("login_qr_create", { key, qrimg: "true" }),

  qrCheck: (key: string) => ncmApi<QrCheckResponse>("login_qr_check", { key }),

  loginStatus: () => ncmApi<LoginStatusResponse>("login_status"),
};
