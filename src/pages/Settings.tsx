import { Effect } from "@tauri-apps/api/window";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
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
import { useUiStore } from "@/stores";
import type { Theme } from "@/stores/uiStore";

const labels: Record<Theme, string> = {
  system: "系统",
  light: "浅色",
  dark: "深色",
};

export default function Settings() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const [windowEffect, setWindowEffectState] = useState<Effect>(Effect.Mica);
  const [closeToTray, setCloseToTray] = useState(false);

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
              <span className="text-sm text-muted-foreground">0.1.0</span>
            </Row>
            <Row label="检查更新">
              <span className="text-sm text-muted-foreground">已是最新</span>
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
