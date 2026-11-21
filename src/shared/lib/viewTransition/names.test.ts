import { describe, expect, it } from 'vitest';
import { findNameCollisions, vtName } from './names';

/** 假的 DOM 元素：断言逻辑只读 `style.viewTransitionName` 与 `isConnected`。 */
const fakeEl = (name: string, connected = true) =>
  ({
    style: { viewTransitionName: name },
    isConnected: connected,
  }) as unknown as HTMLElement;

describe('vtName', () => {
  it('scope 前缀保证是合法 CSS 自定义标识符（纯数字 id 不能直接用）', () => {
    expect(vtName('playlist', 24381616)).toBe('vt-playlist-24381616');
  });

  it('非法字符替换成下划线（id 可能来自字符串主键）', () => {
    expect(vtName('user', 'a.b:c d')).toBe('vt-user-a_b_c_d');
  });
});

describe('findNameCollisions', () => {
  it('同一张快照里同名 ≥2 次就是撞名（浏览器会静默 abort 整场转场）', () => {
    const collisions = findNameCollisions([
      fakeEl('vt-playlist-1'),
      fakeEl('vt-playlist-1'),
    ]);

    expect(collisions).toHaveLength(1);
    expect(collisions[0].name).toBe('vt-playlist-1');
    expect(collisions[0].elements).toHaveLength(2);
  });

  it('游离节点不参与快照，不计入（KeepAlive 缓存页都躺在游离节点里）', () => {
    expect(
      findNameCollisions([
        fakeEl('vt-playlist-1', true),
        fakeEl('vt-playlist-1', false),
      ]),
    ).toEqual([]);
  });

  it('没挂名字（空 / none）的元素不参与', () => {
    expect(
      findNameCollisions([fakeEl(''), fakeEl('none'), fakeEl('none')]),
    ).toEqual([]);
  });

  it('名字不同互不干扰', () => {
    expect(
      findNameCollisions([fakeEl('vt-playlist-1'), fakeEl('vt-playlist-2')]),
    ).toEqual([]);
  });
});
