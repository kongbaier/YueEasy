import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 特性测试配置：node 环境即可（被测对象是纯逻辑引擎 QueueManager，无 DOM 依赖）。
// `@/` 路径别名与 vite.config.ts / tsconfig.json 保持一致，指向 ./src。
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
