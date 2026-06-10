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
          // silently fail, user can retry by revisiting LikedSongs page
        });
    } else {
      useLikeStore.getState().clear();
    }
  }, [isLoggedIn, userId]);
};
