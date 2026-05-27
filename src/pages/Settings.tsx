import { useUiStore } from "@/stores";

export function Settings() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-2xl font-bold">设置</h1>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">主题</span>
          <select
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none"
            onChange={(e) => setTheme(e.target.value as "light" | "dark")}
            value={theme}
          >
            <option value="dark">深色</option>
            <option value="light">浅色</option>
          </select>
        </div>
      </div>
    </div>
  );
}
