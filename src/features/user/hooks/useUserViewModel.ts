import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserDetail } from '../user-service';
import { getUserPlaylists } from '@/shared/services/UserService';

/**
 * 用户主页 viewmodel：用户详情 + 歌单列表两条查询。
 *
 * 歌单查询键统一为 `['userPlaylists', uid]`，同一用户在多处（我的主页 / 用户主页）共享缓存，
 * 收藏 / 取消收藏歌单后的失效一次即可覆盖。
 */
export function useUserViewModel(uid: number) {
  const detail = useQuery({
    queryKey: ['userDetail', uid],
    queryFn: () => getUserDetail(uid),
    throwOnError: true,
  });

  const playlists = useQuery({
    queryKey: ['userPlaylists', uid],
    queryFn: () => getUserPlaylists(uid),
  });

  const list = useMemo(() => playlists.data ?? [], [playlists.data]);

  const created = useMemo(
    () => list.filter((p) => p.creator?.id === uid),
    [list, uid],
  );
  const favorited = useMemo(
    () => list.filter((p) => p.creator?.id !== uid),
    [list, uid],
  );

  return {
    user: detail.data?.user,
    detail: detail.data,
    created,
    favorited,
    isPending: detail.isPending,
    playlistsPending: playlists.isPending,
  };
}
