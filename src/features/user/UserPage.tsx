import { useParams } from 'react-router-dom';
import { UserProfile } from './components/UserProfile';

/**
 * 用户主页（二级页 `/user/:id`）：薄壳，只解析路由参数，主体见 `UserProfile`。
 *
 * 自己的一级页入口是 `MyHomePage`（`/my`），两者共用同一个 `UserProfile`，
 * 不再有独立的「我的歌单」页。
 */
export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const uid = Number(id);

  if (!Number.isInteger(uid) || uid <= 0) throw new Error('无效的用户 ID');

  return <UserProfile uid={uid} />;
}
