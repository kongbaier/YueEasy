import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageWithFade } from "@/components/ui/image";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ncm, setNcmCookie } from "@/services/ncm";
import { useAuthStore, useUiStore } from "@/stores";

type LoginTab = "password" | "sms" | "qr";

const tabs: { key: LoginTab; label: string }[] = [
  { key: "password", label: "密码登录" },
  { key: "sms", label: "短信登录" },
  { key: "qr", label: "扫码登录" },
];

export const LoginDialog = () => {
  const [tab, setTab] = useState<LoginTab>("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [qrImg, setQrImg] = useState("");
  const [qrStatus, setQrStatus] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const qrKeyRef = useRef("");
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const open = useUiStore((s) => s.loginDialogOpen);
  const setOpen = useUiStore((s) => s.setLoginDialogOpen);

  const clearQrTimer = useCallback(() => {
    if (qrTimerRef.current !== undefined) {
      clearInterval(qrTimerRef.current);
      qrTimerRef.current = undefined;
    }
  }, []);

  const onAuthSuccess = useCallback(
    (
      cookie: string,
      profile?: { userId: number; nickname: string; avatarUrl: string },
    ) => {
      setNcmCookie(cookie);
      setAuth({
        isLoggedIn: true,
        cookie,
        userId: profile?.userId ?? null,
        nickname: profile?.nickname ?? "",
        avatarUrl: profile?.avatarUrl ?? "",
      });
      setOpen(false);
      toast.success(`登录成功，欢迎 ${profile?.nickname || "回来"}`);
      navigate("/");
    },
    [setAuth, setOpen, navigate],
  );

  const resetState = () => {
    setPhone("");
    setPassword("");
    setCode("");
    setLoading(false);
    setError("");
    setSending(false);
    setCountdown(0);
    setQrImg("");
    setQrStatus("");
    setQrLoading(false);
    qrKeyRef.current = "";
    clearQrTimer();
    setTab("password");
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) resetState();
  };

  const handleTabChange = (newTab: LoginTab) => {
    setTab(newTab);
    setError("");
    if (newTab !== "qr") {
      clearQrTimer();
    }
  };

  // --- Password login ---
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await ncm.loginCellphone({ phone, password });
      if (res.code === 200) {
        onAuthSuccess(res.cookie, res.profile);
      } else {
        setError(`登录失败 (${res.code})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  // --- SMS login ---
  const handleSendCode = async () => {
    if (!phone || sending || countdown > 0) return;
    setSending(true);
    setError("");
    try {
      const res = await ncm.captchaSent(phone);
      if (res.code === 200) {
        setCountdown(60);
      } else {
        setError(res.message || `发送失败 (${res.code})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送验证码失败");
    } finally {
      setSending(false);
    }
  };

  const handleSmsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setLoading(true);
    setError("");
    try {
      const res = await ncm.loginCellphone({ phone, captcha: code });
      console.log(res);
      if (res.code === 200) {
        onAuthSuccess(res.cookie, res.profile);
      } else {
        setError(`登录失败 (${res.code})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  // --- QR login ---
  const startQrFlow = useCallback(async () => {
    clearQrTimer();
    setQrLoading(true);
    setQrStatus("");
    setError("");
    try {
      const keyRes = await ncm.qrKey();
      const key = keyRes.unikey;
      if (!key) {
        setError("获取二维码密钥失败");
        setQrLoading(false);
        return;
      }
      qrKeyRef.current = key;

      const qrRes = await ncm.qrCreate(key);
      const qrurl = qrRes.data.qrurl;
      setQrImg(
        qrRes.data.qrimg ||
          `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrurl)}`,
      );
      setQrStatus("请使用网易云音乐 App 扫码");
      setQrLoading(false);

      qrTimerRef.current = setInterval(async () => {
        try {
          const checkRes = await ncm.qrCheck(qrKeyRef.current);
          switch (checkRes.code) {
            case 803:
              clearQrTimer();
              onAuthSuccess(checkRes.cookie);
              break;
            case 802:
              setQrStatus("已扫码，请在手机上确认登录");
              break;
            case 801:
              setQrStatus("请使用网易云音乐 App 扫码");
              break;
            case 800:
              clearQrTimer();
              setQrImg("");
              setQrStatus("二维码已过期，点击刷新");
              break;
          }
        } catch {
          // polling errors are silent
        }
      }, 3000);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "获取二维码失败");
      setQrLoading(false);
    }
  }, [clearQrTimer, onAuthSuccess]);

  // Start QR flow when tab becomes "qr" and dialog is open
  useEffect(() => {
    if (tab === "qr" && open) {
      startQrFlow();
    }
    return () => {
      clearQrTimer();
    };
  }, [tab, open, startQrFlow, clearQrTimer]);

  // SMS countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) return 0;
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>登录网易云音乐</DialogTitle>
        </DialogHeader>

        <div className="flex rounded-lg bg-muted p-1">
          {tabs.map((t) => (
            <button
              className={cn(
                "flex-1 cursor-pointer rounded-md py-1.5 text-sm font-medium transition-colors",
                tab === t.key
                  ? "bg-background text-foreground shadow-sm dark:shadow-none dark:ring-1 dark:ring-white/10"
                  : "text-muted-foreground hover:text-foreground",
              )}
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="text-center text-sm text-red-500">{error}</p>}

        {tab === "password" && (
          <form className="space-y-4" onSubmit={handlePasswordLogin}>
            <Input
              onChange={(e) => setPhone(e.target.value)}
              placeholder="手机号"
              type="text"
              value={phone}
            />
            <Input
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              type="password"
              value={password}
            />
            <Button
              className="w-full"
              disabled={loading || !phone || !password}
              type="submit"
            >
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
        )}

        {tab === "sms" && (
          <form className="space-y-4" onSubmit={handleSmsLogin}>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                onChange={(e) => setPhone(e.target.value)}
                placeholder="手机号"
                type="text"
                value={phone}
              />
              <Button
                disabled={!phone || sending || countdown > 0}
                onClick={handleSendCode}
                type="button"
                variant="outline"
              >
                {sending
                  ? "发送中..."
                  : countdown > 0
                    ? `${countdown}s`
                    : "发送验证码"}
              </Button>
            </div>
            <Input
              onChange={(e) => setCode(e.target.value)}
              placeholder="验证码"
              type="text"
              value={code}
            />
            <Button
              className="w-full"
              disabled={loading || !phone || !code}
              type="submit"
            >
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
        )}

        {tab === "qr" && (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="flex h-48 w-48 items-center justify-center rounded-lg bg-muted">
              {qrLoading ? (
                <div className="h-full w-full animate-pulse rounded-lg bg-muted-foreground/10" />
              ) : qrImg ? (
                <ImageWithFade
                  alt="QR code"
                  className="h-48 w-48 rounded-lg"
                  src={qrImg}
                />
              ) : (
                <p className="text-sm text-muted-foreground">二维码加载失败</p>
              )}
            </div>
            {qrStatus && (
              <p className="text-sm text-muted-foreground">{qrStatus}</p>
            )}
            {qrStatus === "二维码已过期，点击刷新" && (
              <Button onClick={startQrFlow} size="sm" variant="outline">
                刷新二维码
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
