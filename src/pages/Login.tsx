import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ncm, setNcmCookie } from "@/services/ncm";
import { useAuthStore } from "@/stores";

export function Login() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await ncm.loginCellphone(phone, password);
      if (res.code === 200) {
        setNcmCookie(res.cookie);
        setAuth({
          isLoggedIn: true,
          cookie: res.cookie,
          userId: res.profile?.userId ?? null,
          nickname: res.profile?.nickname ?? "",
          avatarUrl: res.profile?.avatarUrl ?? "",
        });
        navigate("/");
      } else {
        setError(`登录失败 (${res.code})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <form
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-8"
        onSubmit={handleLogin}
      >
        <h1 className="text-center text-xl font-bold">登录网易云音乐</h1>
        {error && <p className="text-center text-sm text-red-500">{error}</p>}
        <input
          className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          onChange={(e) => setPhone(e.target.value)}
          placeholder="手机号"
          type="text"
          value={phone}
        />
        <input
          className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码"
          type="password"
          value={password}
        />
        <button
          className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          disabled={loading || !phone || !password}
          type="submit"
        >
          {loading ? "登录中..." : "登录"}
        </button>
      </form>
    </div>
  );
}
