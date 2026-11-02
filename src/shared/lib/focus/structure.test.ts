import { describe, expect, it } from 'vitest';
import { pruneContainers } from './structure';

interface Node {
  id: string;
  parent: Node | null;
  pinned?: boolean;
}

const node = (
  id: string,
  parent: Node | null = null,
  pinned = false,
): Node => ({
  id,
  parent,
  pinned,
});

const prune = (items: Node[]) =>
  pruneContainers(items, {
    parentOf: (item) => item.parent,
    isPinned: (item) => item.pinned === true,
  }).map((item) => item.id);

describe('pruneContainers', () => {
  it('包着其他条目的可聚焦壳被剔除（Tab 落在第一个真实条目上）', () => {
    // 侧栏：可聚焦的滚动层里包着「发现 / 搜索 / 我的喜欢」三个导航按钮
    const scroll = node('scroll'); // 例：SimpleBar 的 role=region + tabIndex=0
    const menu = node('menu', scroll);
    const home = node('home', menu);
    const search = node('search', menu);
    const myLiked = node('myLiked', menu);

    expect(prune([scroll, home, search, myLiked])).toEqual([
      'home',
      'search',
      'myLiked',
    ]);
  });

  it('显式钉住的容器条目（整行可点 + 行内红心）保留', () => {
    const row1 = node('row1', null, true);
    const like1 = node('like1', row1);
    const album1 = node('album1', row1);
    const row2 = node('row2', null, true);
    const like2 = node('like2', row2);

    expect(prune([row1, like1, album1, row2, like2])).toEqual([
      'row1',
      'like1',
      'album1',
      'row2',
      'like2',
    ]);
  });

  it('未钉住的容器被剔除，内部条目保留（行内按钮仍可键盘到达）', () => {
    const row = node('row'); // 忘记标 data-focus-item 的行
    const like = node('like', row);
    expect(prune([row, like])).toEqual(['like']);
  });

  it('多层嵌套：只剔除容器，叶子条目全部保留', () => {
    const outer = node('outer');
    const inner = node('inner', outer);
    const a = node('a', inner);
    const b = node('b', inner);
    expect(prune([outer, inner, a, b])).toEqual(['a', 'b']);
  });

  it('叶子条目（按钮 / 链接）不受影响', () => {
    const a = node('a');
    const b = node('b');
    expect(prune([a, b])).toEqual(['a', 'b']);
  });
});
