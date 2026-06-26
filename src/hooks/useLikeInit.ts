import { useEffect } from "react";
import { ncm } from "@/services/ncm";
import { useAuthStore, useLikeStore } from "@/stores";

export const useLikeInit = () => {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    if (isLoggedIn && userId) {
      ncm
        .likeList(userId)
        .then((res) => {
          useLikeStore.getState().init(res.ids);
        })
        .catch(() => {
          // 网络错误，喜欢列表同步失败
          // 不影响使用——收藏/取消收藏操作有自己的错误处理
        });
    } else {
      useLikeStore.getState().clear();
    }
  }, [isLoggedIn, userId]);
};
