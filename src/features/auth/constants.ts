/**
 * 扫码登录流程的 UI 状态标签（tag）。
 * 与展示文案（msg）分离：视图用 tag 做分支判断，用 msg 做渲染，
 * 避免出现 `status === '二维码已过期，点击刷新'` 这类对文案的脆弱比较。
 */
export type QrPhase =
  | 'loading' // 取 key / 生成二维码中
  | 'waiting' // 等待扫码（801）
  | 'scanned' // 已扫码待确认（802）
  | 'expired' // 二维码过期（800）
  | 'error'; // 流程出错

/** 各状态对应的提示文案；loading / error 无文案（error 走 error 字段）。 */
export const QR_PHASE_MESSAGE: Record<QrPhase, string> = {
  loading: '请使用网易云音乐 App 扫码',
  waiting: '请使用网易云音乐 App 扫码',
  scanned: '已扫码，请在手机上确认登录',
  expired: '二维码已过期，点击刷新',
  error: '',
};
