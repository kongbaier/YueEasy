import { describe, expect, it } from 'vitest';
import { queueItemToSong, songToQueueItem } from './mappers';
import type { Song } from '@/shared/types/uiModels';

const song: Song = {
  id: 186016,
  name: '晴天',
  artists: [
    { id: 6452, name: '周杰伦' },
    { id: 1234, name: '其他' },
  ],
  album: { id: 18905, name: '叶惠美', picUrl: 'https://example.com/a.jpg' },
  durationMs: 269743,
};

describe('queueItem ↔ Song', () => {
  /**
   * 回归：歌手 / 专辑 id 必须随队列持久化（曾用 track_id 冒充歌手 id，
   * 播放器里点歌手名会请求 `/artist/<歌曲id>` 并拿到 404）。
   */
  it('保留歌手与专辑 id，往返后能还原跳转所需的实体', () => {
    const item = songToQueueItem(song);

    expect(item.artist).toBe('周杰伦 / 其他');
    expect(item.artists).toEqual([
      { id: 6452, name: '周杰伦' },
      { id: 1234, name: '其他' },
    ]);
    expect(item.album_id).toBe(18905);

    const back = queueItemToSong(item);
    expect(back.artists.map((a) => a.id)).toEqual([6452, 1234]);
    expect(back.album.id).toBe(18905);
    expect(back.album.name).toBe('叶惠美');
    expect(back.durationMs).toBe(269743);
  });

  /** 快照约定字段缺失（升级前的旧快照）时按空处理，不再用名字拼假 id。 */
  it('快照缺少 artists 字段时还原为空列表', () => {
    const back = queueItemToSong({
      track_id: 9,
      title: '某首歌',
      artist: 'A / B',
      album: '某专辑',
      cover_url: '',
      duration_secs: 3,
    });

    expect(back.artists).toEqual([]);
    expect(back.name).toBe('某首歌');
    expect(back.album.name).toBe('某专辑');
  });
});
