import { formatCount } from '@/shared/utils/format';
import { TabBar as UnderlineTabs, type TabBarItem } from '@/shared/ui/tab-bar';

export type TabKey = 'songs' | 'comments';

interface TabBarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
  songCount?: number;
  commentCount?: number;
}

/**
 * 歌单详情分类条：只负责决定「每个分类带不带角标」（歌曲数恒显、评论数 0 不显），
 * 视觉与交互复用 `shared/ui/tab-bar`。
 */
export const TabBar = ({
  active,
  onChange,
  songCount,
  commentCount,
}: TabBarProps) => {
  const items: TabBarItem<TabKey>[] = [
    {
      key: 'songs',
      label: '歌曲',
      badge: songCount != null ? formatCount(songCount) : undefined,
    },
    {
      key: 'comments',
      label: '评论',
      badge:
        commentCount != null && commentCount > 0
          ? formatCount(commentCount)
          : undefined,
    },
  ];

  return <UnderlineTabs active={active} items={items} onChange={onChange} />;
};
