import { Check } from "lucide-react";
import type { Theme } from "@/stores/uiStore";
import { useUiStore } from "@/stores";
import { Select } from "@/components/ui/select";

const labels: Record<Theme, string> = {
  system: "系统",
  light: "浅色",
  dark: "深色",
};

export default function Settings() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-2xl font-bold">设置</h1>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">主题</span>
          <Select.Root value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            <Select.Trigger className="w-28">
              <Select.Value>{labels[theme]}</Select.Value>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.List>
                    {(Object.entries(labels) as [Theme, string][]).map(([value, label]) => (
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
        </div>
      </div>
    </div>
  );
}
