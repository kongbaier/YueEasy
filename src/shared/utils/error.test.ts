// 错误契约测试：Rust IPC 错误 `{ kind, message, detail? }` 的展示 / 排查分工。
// 纯函数，node 环境即可。

import { describe, expect, it, vi } from 'vitest';
import { errorDetail, errorMessage, reportError } from './error';

describe('errorMessage（给人看）', () => {
  it('Error / IPC 对象 / 字符串三种 reject 形态通吃', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage({ kind: 'network', message: '请求超时' })).toBe(
      '请求超时',
    );
    expect(errorMessage('网络错误：无法连接服务器')).toBe(
      '网络错误：无法连接服务器',
    );
  });

  it('缺失 / 空 message 回落 fallback', () => {
    expect(errorMessage(undefined, '播放失败')).toBe('播放失败');
    expect(errorMessage({ kind: 'api', message: '' }, '播放失败')).toBe(
      '播放失败',
    );
    expect(errorMessage({ kind: 'api' })).toBe('操作失败，请重试');
  });
});

describe('errorDetail（给 devtools）', () => {
  it('取 Rust 侧的根因链，不进 message', () => {
    const e = {
      kind: 'network',
      message: '网络错误：无法连接服务器，请检查网络',
      detail: 'HTTP request failed: ... | 根因：dns error: ...',
    };
    expect(errorMessage(e)).toBe('网络错误：无法连接服务器，请检查网络');
    expect(errorDetail(e)).toBe('HTTP request failed: ... | 根因：dns error: ...');
  });

  it('没有 detail 时返回 null', () => {
    expect(errorDetail(new Error('boom'))).toBeNull();
    expect(errorDetail({ kind: 'api', message: '需要登录' })).toBeNull();
  });
});

describe('reportError（打点 + 取文案）', () => {
  it('message 与 detail 一起进控制台，返回 message 供 toast', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const message = reportError(
      'player.resolve',
      { kind: 'network', message: '请求超时', detail: 'tokio timeout(10s)' },
      '播放失败',
    );
    expect(message).toBe('请求超时');
    expect(spy).toHaveBeenCalledOnce();
    expect(String(spy.mock.calls[0][0])).toContain('[player.resolve] 请求超时');
    expect(String(spy.mock.calls[0][0])).toContain('tokio timeout(10s)');
    spy.mockRestore();
  });

  it('无 detail 时原样打印异常对象（保留 stack）', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('boom');
    expect(reportError('x', err, '兜底')).toBe('boom');
    expect(spy).toHaveBeenCalledWith('[x]', err);
    spy.mockRestore();
  });
});
