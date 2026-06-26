import { getVersion } from "@tauri-apps/api/app";
import { Effect } from "@tauri-apps/api/window";
import { Check, LogOut, RefreshCw, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ImageWithFade } from "@/components/common/image";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast";
import {
  getSetting,
  setSetting,
  setWindowEffect,
  windowEffectLabels,
} from "@/services/tauri";
import {
  checkForUpdate,
  downloadAndInstall,
  installAndRelaunch,
  type Update,
} from "@/services/updater";
import { useAuthStore, useUiStore } from "@/stores";
import type { Theme } from "@/stores/uiStore";

const labels: Record<Theme, string> = {
  system: "系统",
  light: "浅色",
  dark: "深色",
};

export default function Settings() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const nickname = useAuthStore((s) => s.nickname);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const userId = useAuthStore((s) => s.userId);
  const logout = useAuthStore((s) => s.logout);
  const setLoginDialogOpen = useUiStore((s) => s.setLoginDialogOpen);
  const [windowEffect, setWindowEffectState] = useState<Effect>(Effect.Mica);
  const [closeToTray, setCloseToTray] = useState(false);

  // --- 检查更新状态 ---
  type UpdateStatus =
    | "idle"
    | "checking"
    | "up-to-date"
    | "available"
    | "downloading"
    | "installing"
    | "error";

  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [appVersion, setAppVersion] = useState("...");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("0.0.0"));
  }, []);

  useEffect(() => {
    getSetting("window_effect").then((effect) => {
      if (effect) setWindowEffectState(effect as Effect);
    });
    getSetting("close_behavior").then((v) => {
      setCloseToTray(v === "hide");
    });
  }, []);

  const handleEffectChange = (effect: Effect) => {
    setWindowEffectState(effect);
    setSetting("window_effect", effect);
    setWindowEffect(effect).catch(() => {
      setWindowEffectState(Effect.Mica);
      setSetting("window_effect", Effect.Mica);
      toast.error("该效果不可用，已恢复为 Mica");
    });
  };

  const handleCloseToTrayChange = (checked: boolean) => {
    setCloseToTray(checked);
    setSetting("close_behavior", checked ? "hide" : "quit");
  };

  const handleCheckUpdate = useCallback(async () => {
    setUpdateStatus("checking");
    try {
      const u = await checkForUpdate();
      if (u) {
        setUpdate(u);
        setUpdateStatus("available");
      } else {
        setUpdateStatus("up-to-date");
      }
    } catch {
      setUpdateStatus("error");
      toast.error("检查更新失败，请检查网络连接");
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (!update) return;
    setUpdateStatus("downloading");
    setDownloadProgress(0);
    try {
      await downloadAndInstall(update, (downloaded, total) => {
        if (total) {
          setDownloadProgress(Math.round((downloaded / total) * 100));
        }
      });
      setUpdateStatus("installing");
      await installAndRelaunch();
    } catch {
      setUpdateStatus("available");
      toast.error("下载失败，请重试");
    }
  }, [update]);

  return (
    <div className="mx-auto w-full max-w-2xl px-8 py-8 animate-content-enter">
      <h1 className="mb-10 text-2xl font-semibold tracking-tight">设置</h1>

      <div className="space-y-6">
        <SectionCard>
          <SectionTitle>外观</SectionTitle>
          <div className="space-y-0.5">
            <Row label="主题">
              <Select.Root
                onValueChange={(v) => setTheme(v as Theme)}
                value={theme}
              >
                <Select.Trigger className="w-28">
                  <Select.Value>{labels[theme]}</Select.Value>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner>
                    <Select.Popup>
                      <Select.List>
                        {Object.entries(labels).map(([value, label]) => (
                          <Select.Item key={value} value={value}>
                            <Select.ItemText>{label}</Select.ItemText>
                            <Select.ItemIndicator>
                              <Check className="size-4" />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.List>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </Row>
            <Row description="Windows 窗口材质效果" label="窗口效果">
              <Select.Root
                onValueChange={(v) => handleEffectChange(v as Effect)}
                value={windowEffect}
              >
                <Select.Trigger className="w-30">
                  <Select.Value>
                    {windowEffectLabels[windowEffect]}
                  </Select.Value>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner>
                    <Select.Popup>
                      <Select.List className="space-y-0.5">
                        {Object.entries(windowEffectLabels).map(
                          ([value, label]) => (
                            <Select.Item key={value} value={value}>
                              <Select.ItemText>{label}</Select.ItemText>
                              <Select.ItemIndicator>
                                <Check className="size-4" />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ),
                        )}
                      </Select.List>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </Row>
            <Row label="关闭时隐藏窗口">
              <Switch
                checked={closeToTray}
                className=""
                onCheckedChange={handleCloseToTrayChange}
              />
            </Row>
            <Row description="界面显示语言" label="语言">
              <span className="text-sm text-muted-foreground">简体中文</span>
            </Row>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionTitle>账户</SectionTitle>
          <div className="space-y-0.5">
            {isLoggedIn ? (
              <>
                <Row label="用户">
                  <div className="flex items-center gap-2">
                    {avatarUrl ? (
                      <ImageWithFade
                        alt={nickname}
                        className="size-6 rounded-full object-cover"
                        src={avatarUrl}
                      />
                    ) : (
                      <User className="size-5 text-muted-foreground" />
                    )}
                    <span className="text-sm">{nickname || `ID: ${userId}`}</span>
                  </div>
                </Row>
                <Row label="用户 ID">
                  <span className="text-sm text-muted-foreground">{userId}</span>
                </Row>
                <Row label="退出登录">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      logout();
                      toast.success("已退出登录");
                    }}
                  >
                    <LogOut className="size-3.5" />
                    退出登录
                  </Button>
                </Row>
              </>
            ) : (
              <Row label="登录网易云音乐">
                <Button
                  size="xs"
                  onClick={() => setLoginDialogOpen(true)}
                >
                  立即登录
                </Button>
              </Row>
            )}
          </div>
        </SectionCard>

        <SectionCard>
          <SectionTitle>播放</SectionTitle>
          <div className="space-y-0.5">
            <Row description="新播放队列的默认模式" label="默认播放模式">
              <span className="text-sm text-muted-foreground">顺序播放</span>
            </Row>
            <Row description="音频流传输质量" label="播放音质">
              <span className="text-sm text-muted-foreground">极高</span>
            </Row>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionTitle>缓存</SectionTitle>
          <div className="space-y-0.5">
            <Row description="本地缓存占用空间" label="缓存大小">
              <span className="text-sm text-muted-foreground">-- MB</span>
            </Row>
            <Row label="清除缓存">
              <Button size="xs" variant="outline">
                清除
              </Button>
            </Row>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionTitle>关于</SectionTitle>
          <div className="space-y-0.5">
            <Row label="版本号">
              <span className="text-sm text-muted-foreground">{appVersion}</span>
            </Row>
            <Row label="检查更新">
              {updateStatus === "idle" && (
                <Button size="xs" variant="outline" onClick={handleCheckUpdate}>
                  检查更新
                </Button>
              )}
              {updateStatus === "checking" && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <RefreshCw className="size-3 animate-spin" />
                  正在检查...
                </span>
              )}
              {updateStatus === "up-to-date" && (
                <span className="text-sm text-muted-foreground">已是最新</span>
              )}
              {updateStatus === "available" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {update?.version}
                  </span>
                  <Button size="xs" onClick={handleDownload}>
                    立即更新
                  </Button>
                </div>
              )}
              {updateStatus === "downloading" && (
                <span className="text-sm text-muted-foreground">
                  下载中 {downloadProgress}%
                </span>
              )}
              {updateStatus === "installing" && (
                <span className="text-sm text-muted-foreground">
                  正在安装...
                </span>
              )}
              {updateStatus === "error" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-500">检查失败</span>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={handleCheckUpdate}
                  >
                    重试
                  </Button>
                </div>
              )}
            </Row>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card px-5 py-4">
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="h-5 w-0.5 rounded-full bg-primary/70" />
      <h2 className="text-base font-semibold">{children}</h2>
    </div>
  );
}

const Row = ({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2 transition-all duration-150 hover:bg-surface-hover">
      <div>
        <span className="text-sm">{label}</span>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
};
