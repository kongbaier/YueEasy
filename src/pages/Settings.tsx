import { Effect } from "@tauri-apps/api/window";
import { Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
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

type SectionKey = "appearance" | "playback" | "cache" | "about";

const tabs: { key: SectionKey; label: string }[] = [
  { key: "appearance", label: "外观" },
  { key: "playback", label: "播放" },
  { key: "cache", label: "缓存" },
  { key: "about", label: "关于" },
];

export default function Settings() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const [activeTab, setActiveTab] = useState<SectionKey>("appearance");
  const [windowEffect, setWindowEffectState] = useState<Effect>(Effect.Mica);

  useEffect(() => {
    getSetting("window_effect")
      .then((v) => {
        if (v) setWindowEffectState(v as Effect);
      })
      .catch(() => {});
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

  const sectionRefs = useRef<Record<SectionKey, HTMLElement | null>>({
    appearance: null,
    playback: null,
    cache: null,
    about: null,
  });

  const scrollToSection = useCallback((key: SectionKey) => {
    setActiveTab(key);
    sectionRefs.current[key]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  return (
    <div className="w-full px-8 py-4">
      <nav className="sticky top-10 z-10 flex gap-1 p-1 mb-8 rounded-lg bg-muted">
        {tabs.map((tab) => (
          <button
            className={cn(
              "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm dark:shadow-none dark:ring-1 dark:ring-white/10"
                : "text-muted-foreground hover:text-foreground",
            )}
            key={tab.key}
            onClick={() => scrollToSection(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="space-y-12">
        <section
          ref={(el) => {
            sectionRefs.current.appearance = el;
          }}
        >
          <h2 className="text-lg font-semibold mb-4">外观</h2>
          <div className="space-y-3">
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
                        {(Object.entries(labels) as [Theme, string][]).map(
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
                      <Select.List>
                        {(
                          Object.entries(windowEffectLabels) as [
                            string,
                            string,
                          ][]
                        ).map(([value, label]) => (
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
            <Row description="界面显示语言" label="语言">
              <span className="text-sm text-muted-foreground">简体中文</span>
            </Row>
          </div>
          <Separator className="mt-6" />
        </section>

        <section
          ref={(el) => {
            sectionRefs.current.playback = el;
          }}
        >
          <h2 className="text-lg font-semibold mb-4">播放</h2>
          <div className="space-y-3">
            <Row description="新播放队列的默认模式" label="默认播放模式">
              <span className="text-sm text-muted-foreground">顺序播放</span>
            </Row>
            <Row description="音频流传输质量" label="播放音质">
              <span className="text-sm text-muted-foreground">极高</span>
            </Row>
          </div>
          <Separator className="mt-6" />
        </section>

        <section
          ref={(el) => {
            sectionRefs.current.cache = el;
          }}
        >
          <h2 className="text-lg font-semibold mb-4">缓存</h2>
          <div className="space-y-3">
            <Row description="本地缓存占用空间" label="缓存大小">
              <span className="text-sm text-muted-foreground">-- MB</span>
            </Row>
            <Row label="清除缓存">
              <button
                className="text-sm text-primary hover:text-primary-dark transition-colors"
                type="button"
              >
                清除
              </button>
            </Row>
          </div>
          <Separator className="mt-6" />
        </section>

        <section
          ref={(el) => {
            sectionRefs.current.about = el;
          }}
        >
          <h2 className="text-lg font-semibold mb-4">关于</h2>
          <div className="space-y-3">
            <Row label="版本号">
              <span className="text-sm text-muted-foreground">0.1.0</span>
            </Row>
            <Row label="检查更新">
              <span className="text-sm text-muted-foreground">已是最新</span>
            </Row>
          </div>
          <Separator className="mt-6" />
        </section>
      </div>
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
    <div className="flex items-center justify-between py-1">
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
