// NCM IPC 入口：各域 `const` invoke 函数聚合为 `ncm` 命名空间。
// UI 层禁止直接 import 本模块；service 层经 `ncm.*` 消费（见 AGENTS.md §7）。

import * as auth from './auth';
import * as comment from './comment';
import * as discover from './discover';
import * as playlist from './playlist';
import * as song from './song';

export const ncm = {
  ...auth,
  ...comment,
  ...discover,
  ...playlist,
  ...song,
};

export { clearNcmCookie, getNcmCookie, setNcmCookie } from './cookie';
