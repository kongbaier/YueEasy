import {
  Check,
  Database,
  Headphones,
  Info,
  LogOut,
  Palette,
  RefreshCw,
  User,
} from 'lucide-react';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import { useAppearanceSetting, usePlayerSetting } from '@/shared/hooks/useSetting';
import { useSettingsViewModel } from './useSettingsViewModel';
import { toast } from '@/shared/lib/toast';
import type { Theme } from '@/shared/types/settings';
import { Button } from '@/shared/ui/button';
import { Select } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { DecodedImage } from '@/shared/ui/image';
import { Effect, type WindowsEffect } from '@/shared/types/effect';

const labels: Record<Theme, string> = {
  system: '系统',
  light: '浅色',
  dark: '深色',
};

const windowsEffectLabels: Record<WindowsEffect, string> = {
  [Effect.Mica]: "Mica",
  [Effect.Tabbed]: "Mica Alt",
  [Effect.Acrylic]: "Acrylic",
};

export default function Settings() {
  usePageTitle('设置', { root: true });
  const [theme, setTheme] = useAppearanceSetting('theme');
  const [windowEffect, setWindowEffectState] =
    useAppearanceSetting("windowEffect");
  const [closeBehavior, setCloseBehavior] =
    useAppearanceSetting("closeBehavior");
  const closeToTray = closeBehavior === 'hide';
  const [savePlaybackHistory, setSavePlaybackHistory] =
    usePlayerSetting("savePlaybackHistory");
  const {
    isLoggedIn,
    nickname,
    avatarUrl,
    userId,
    logout,
    openLogin,
    cacheCount,
    updateStatus,
    update,
    downloadProgress,
    appVersion,
    handleEffectChange: applyWindowEffect,
    handleClearCache: clearCache,
    handleCheckUpdate: checkUpdate,
    handleDownloadAndInstall,
  } = useSettingsViewModel();

  const handleClearCache = async () => {
    try {
      await clearCache();
      toast.success('缓存已清除');
    } catch {
      toast.error('清除缓存失败');
    }
  };

  const handleEffectChange = async (effect: WindowsEffect) => {
    setWindowEffectState(effect);
    const ok = await applyWindowEffect(effect);
    if (!ok) {
      setWindowEffectState(Effect.Mica);
      toast.error('该效果不可用，已恢复为 Mica');
    }
  };

  const handleCloseToTrayChange = (checked: boolean) => {
    setCloseBehavior(checked ? 'hide' : 'quit');
  };

  const handleCheckUpdate = async () => {
    try {
      await checkUpdate();
    } catch {
      toast.error('检查更新失败，请检查网络连接');
    }
  };

  const handleDownload = async () => {
    try {
      await handleDownloadAndInstall();
    } catch {
      toast.error('下载失败，请重试');
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl px-4 sm:px-8 py-6 sm:py-8 animate-content-enter">
      {/* Page heading */}
      <div className="mb-6 sm:mb-8 flex items-center gap-3">
        <div className="h-7 w-1 rounded-full bg-primary" />
        <h1 className="text-xl font-semibold tracking-tight">设置</h1>
      </div>

      <div className="space-y-5 sm:space-y-6">
        <SectionCard style={{ animationDelay: '0ms' }}>
          <SectionTitle icon={Palette}>外观</SectionTitle>
          <div className="divide-y divide-border/10">
            <Row label="主题">
              <Select.Root
                onValueChange={(v) => setTheme(v as Theme)}
                value={theme}
              >
                <Select.Trigger className="w-28">
                  <Select.Value>{labels[theme as Theme]}</Select.Value>
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
                onValueChange={(v) => handleEffectChange(v as WindowsEffect)}
                value={windowEffect}
              >
                <Select.Trigger className="w-30">
                  <Select.Value>
                    {windowsEffectLabels[windowEffect]}
                  </Select.Value>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner>
                    <Select.Popup>
                      <Select.List className="space-y-0.5">
                        {Object.entries(windowsEffectLabels).map(
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

        <SectionCard style={{ animationDelay: '80ms' }}>
          <SectionTitle icon={User}>账户</SectionTitle>
          <div className="divide-y divide-border/10">
            {isLoggedIn ? (
              <>
                <Row label="用户">
                  <div className="flex items-center gap-2">
                    {avatarUrl ? (
                      <DecodedImage
                        alt={nickname}
                        className="size-full object-cover"
                        containerClassName="size-6 rounded-full"
                        src={avatarUrl}
                      />
                    ) : (
                      <User className="size-5 text-muted-foreground" />
                    )}
                    <span className="text-sm">
                      {nickname || `ID: ${userId}`}
                    </span>
                  </div>
                </Row>
                <Row label="用户 ID">
                  <span className="text-sm text-muted-foreground">
                    {userId}
                  </span>
                </Row>
                <Row label="退出登录">
                  <Button
                    onClick={() => {
                      logout();
                      toast.success('已退出登录');
                    }}
                    size="xs"
                    variant="outline"
                  >
                    <LogOut className="size-3.5" />
                    退出登录
                  </Button>
                </Row>
              </>
            ) : (
              <Row label="登录网易云音乐">
                <Button onClick={() => openLogin()} size="xs">
                  立即登录
                </Button>
              </Row>
            )}
          </div>
        </SectionCard>

        <SectionCard style={{ animationDelay: '160ms' }}>
          <SectionTitle icon={Headphones}>播放</SectionTitle>
          <div className="divide-y divide-border/10">
            <Row description="新播放队列的默认模式" label="默认播放模式">
              <span className="text-sm text-muted-foreground">顺序播放</span>
            </Row>
            <Row description="音频流传输质量" label="播放音质">
              <span className="text-sm text-muted-foreground">极高</span>
            </Row>
            <Row description="在最近播放中综合展示本机播放记录" label="本地播放记录">
              <Switch
                checked={savePlaybackHistory}
                onCheckedChange={setSavePlaybackHistory}
              />
            </Row>
          </div>
        </SectionCard>

        <SectionCard style={{ animationDelay: '240ms' }}>
          <SectionTitle icon={Database}>缓存</SectionTitle>
          <div className="divide-y divide-border/10">
            <Row description="本地缓存条目数" label="缓存大小">
              <span className="text-sm text-muted-foreground">
                {cacheCount === null ? '--' : `${cacheCount} 项`}
              </span>
            </Row>
            <Row label="清除缓存">
              <Button
                disabled={cacheCount === 0 || cacheCount === null}
                onClick={handleClearCache}
                size="xs"
                variant="outline"
              >
                清除
              </Button>
            </Row>
          </div>
        </SectionCard>

        <SectionCard style={{ animationDelay: '320ms' }}>
          <SectionTitle icon={Info}>关于</SectionTitle>
          <div className="divide-y divide-border/10">
            <Row label="版本号">
              <span className="text-sm text-muted-foreground">
                {appVersion}
              </span>
            </Row>
            <Row label="检查更新">
              {updateStatus === 'idle' && (
                <Button onClick={handleCheckUpdate} size="xs" variant="outline">
                  检查更新
                </Button>
              )}
              {updateStatus === 'checking' && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <RefreshCw className="size-3 animate-spin" />
                  正在检查...
                </span>
              )}
              {updateStatus === 'up-to-date' && (
                <span className="text-sm text-muted-foreground">已是最新</span>
              )}
              {updateStatus === 'available' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {update?.version}
                  </span>
                  <Button onClick={handleDownload} size="xs">
                    立即更新
                  </Button>
                </div>
              )}
              {updateStatus === 'downloading' && (
                <span className="text-sm text-muted-foreground">
                  下载中 {downloadProgress}%
                </span>
              )}
              {updateStatus === 'installing' && (
                <span className="text-sm text-muted-foreground">
                  正在安装...
                </span>
              )}
              {updateStatus === 'error' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-destructive">检查失败</span>
                  <Button
                    onClick={handleCheckUpdate}
                    size="xs"
                    variant="outline"
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

function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="rounded-lg border border-border/40 bg-card px-5 py-4 animate-content-enter"
      style={style}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="h-5 w-1 rounded-full bg-primary/70" />
      {Icon && <Icon className="size-4 text-primary/70" />}
      <h2 className="text-sm font-semibold">{children}</h2>
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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg px-3 py-2.5 gap-1 sm:gap-4 transition-all duration-150 hover:bg-surface-hover">
      <div className="min-w-0">
        <span className="text-sm">{label}</span>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        {children}
      </div>
    </div>
  );
};
