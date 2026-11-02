import { User as UserIcon } from 'lucide-react';
import { usePageTitle } from '@/app/layout/PageTitleContext';
import { Button } from '@/shared/ui/button';
import { useAuthViewModel } from '@/features/auth/hooks/useAuthViewModel';
import { UserProfile } from './components/UserProfile';

/**
 * 我的主页（一级页 `/my`）：薄壳页，只做登录门禁 + 取当前用户 id，主体复用 `UserProfile`。
 *
 * 一级页语义：固定标题 / 面包屑根，且 uid 来自登录态而非路由参数；
 * 二级页 `UserPage`（`/user/:id`）引用同一主体，因此「我的主页」与「用户主页」
 * 只有一层包装差异，不再各自维护一份头像 + 歌单 UI（旧的「我的歌单」页已删除）。
 */
export default function MyHomePage() {
  usePageTitle('我的主页', { root: true });
  const { userId, openLogin } = useAuthViewModel();

  if (userId == null) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <UserIcon className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">登录后查看我的主页</p>
        <Button onClick={openLogin}>立即登录</Button>
      </div>
    );
  }

  return <UserProfile title="我的主页" uid={userId} />;
}
