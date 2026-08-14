import { useCallback } from 'react';
import { useQueueStore } from '@/modules/player/stores/queue';
import { toast } from '@/shared/lib/toast';

/** TrackRow 等共享组件获取队列操作能力（playNext/addToQueue）的统一入口。 */
export function useTrackActions() {
  const playNext = useQueueStore((s) => s.playNext);
  const addToQueue = useQueueStore((s) => s.addToQueue);

  const handlePlayNext = useCallback(
    (track: Parameters<typeof playNext>[0]) => {
      void playNext(track);
    },
    [playNext],
  );

  const handleAddToQueue = useCallback(
    (track: Parameters<typeof addToQueue>[0]) => {
      addToQueue(track);
      toast.success(`已添加到播放列表`);
    },
    [addToQueue],
  );

  return { handlePlayNext, handleAddToQueue };
}
