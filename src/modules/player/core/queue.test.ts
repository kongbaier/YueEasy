// QueueEngine 单元测试（前端移植：port of `src-tauri/src/player/queue_test.rs`）。
// 固定种子 42（与 Rust setup 一致）保证 shuffle 排列一一对应。
// 这是移植的「行为锁定」——安全删除 Rust player 的护盾。

import { describe, expect, it } from 'vitest';
import { QueueEngine } from './QueueEngine';
import type { Order, PlayerSnapshot, Repeat } from './types';
import type { QueueItem } from '@/shared/types/entities';

function makeItem(id: number): QueueItem {
  return {
    track_id: id,
    title: `song-${id}`,
    artist: `artist-${id}`,
    album: `album-${id}`,
    cover_url: `https://cover/${id}`,
    duration_secs: 180,
  };
}

function items(n: number): QueueItem[] {
  return Array.from({ length: n }, (_, i) => makeItem(i));
}

/** 固定种子 + append 构造：queue=[0..n)，index=0，Sequential 模式。 */
function setup(n: number): QueueEngine {
  const e = new QueueEngine(42);
  e.append(items(n));
  return e;
}

/** 断言 manualNext() 为 Play 并返回索引。 */
function nextIndex(e: QueueEngine): number {
  const step = e.manualNext();
  if (step.type !== 'play') throw new Error(`expected Play, got ${step.type}`);
  return step.index;
}

function idsOf(e: QueueEngine): number[] {
  return e.queueItems().map((t) => t.track_id);
}

describe('构造与状态访问器', () => {
  it('setup_builds_queue_and_starts_at_first', () => {
    const e = setup(3);
    expect(e.queueItems().length).toBe(3);
    expect(e.currentIdx()).toBe(0);
    expect(e.currentTrack()!.track_id).toBe(0);
    expect(e.order()).toBe('sequential');
    expect(e.repeat()).toBe('off');
    expect(e.isFmActive()).toBe(false);
  });
});

describe('Sequential 模式导航', () => {
  it('sequential_next_moves_forward', () => {
    const e = setup(4);
    e.playQueueAt(1);
    expect(nextIndex(e)).toBe(2);
    expect(e.currentTrack()!.track_id).toBe(2);
  });

  it('sequential_manual_next_wraps_at_end', () => {
    const e = setup(4);
    e.playQueueAt(3);
    expect(e.manualNext()).toEqual({ type: 'play', index: 0 });
    expect(e.currentIdx()).toBe(0);
    expect(e.currentTrack()!.track_id).toBe(0);
  });

  it('sequential_natural_end_marks_ended_and_restart_plays_from_start', () => {
    const e = setup(3);
    e.playQueueAt(2);
    expect(e.onTrackEnd()).toEqual({ type: 'end' });
    expect(e.isEnded()).toBe(true);
    expect(e.currentIdx()).toBe(2);
    expect(e.restart()!.track_id).toBe(0);
    expect(e.isEnded()).toBe(false);
    expect(e.currentIdx()).toBe(0);
  });

  it('manual_next_after_end_resets_ended', () => {
    const e = setup(3);
    e.playQueueAt(2);
    e.onTrackEnd();
    expect(e.isEnded()).toBe(true);
    expect(e.manualNext()).toEqual({ type: 'play', index: 0 });
    expect(e.isEnded()).toBe(false);
    expect(e.currentIdx()).toBe(0);
  });

  it('loop_all_next_at_end_wraps_to_zero', () => {
    const e = setup(4);
    e.playQueueAt(3);
    e.setRepeat('all');
    expect(e.manualNext()).toEqual({ type: 'play', index: 0 });
    expect(e.currentIdx()).toBe(0);
    expect(e.currentTrack()!.track_id).toBe(0);
  });

  it('loop_one_manual_next_advances_to_next', () => {
    const e = setup(4);
    e.playQueueAt(2);
    e.setRepeat('one');
    expect(e.manualNext()).toEqual({ type: 'play', index: 3 });
    expect(e.currentIdx()).toBe(3);
    expect(e.currentTrack()!.track_id).toBe(3);
  });

  it('loop_one_track_end_replays_current', () => {
    const e = setup(4);
    e.playQueueAt(2);
    e.setRepeat('one');
    expect(e.onTrackEnd()).toEqual({ type: 'replayCurrent' });
    expect(e.currentIdx()).toBe(2);
    expect(e.currentTrack()!.track_id).toBe(2);
  });

  it('empty_queue_next_returns_end', () => {
    const e = setup(0);
    expect(e.manualNext()).toEqual({ type: 'end' });
    expect(e.currentIdx()).toBe(null);
  });

  it('fm_next_returns_fetch_fm', () => {
    const e = setup(3);
    e.enterFm(makeItem(100));
    expect(e.isFmActive()).toBe(true);
    expect(e.manualNext()).toEqual({ type: 'end' });
  });

  it('sequential_prev_moves_back_and_wraps_at_first', () => {
    const e = setup(4);
    e.playQueueAt(2);
    expect(e.prev()!.track_id).toBe(1);
    e.playQueueAt(0);
    expect(e.prev()!.track_id).toBe(3);
  });
});

describe('RepeatOne 模式导航', () => {
  it('repeat_one_manual_next_advances_and_track_end_replays', () => {
    const e = setup(4);
    e.playQueueAt(2);
    e.setRepeat('one');
    expect(e.manualNext()).toEqual({ type: 'play', index: 3 });
    expect(e.prev()!.track_id).toBe(2);
    e.playQueueAt(2);
    expect(e.onTrackEnd()).toEqual({ type: 'replayCurrent' });
    expect(e.currentIdx()).toBe(2);
  });

  it('set_mode_loop_one_manual_next_advances', () => {
    const e = setup(4);
    e.playQueueAt(1);
    e.setRepeat('one');
    expect(e.repeat()).toBe('one');
    expect(e.manualNext()).toEqual({ type: 'play', index: 2 });
    expect(e.prev()!.track_id).toBe(1);
    e.playQueueAt(1);
    expect(e.onTrackEnd()).toEqual({ type: 'replayCurrent' });
  });
});

describe('Shuffle 模式导航', () => {
  it('shuffle_off_covers_each_index_once_then_wraps', () => {
    const e = setup(4);
    e.setOrder('shuffle');
    const seen = [e.currentIdx()!];
    for (let i = 0; i < 3; i++) seen.push(nextIndex(e));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    expect(e.manualNext()).toEqual({ type: 'play', index: 0 });
    expect(e.currentTrack()!.track_id).toBe(0);
  });

  it('shuffle_all_wraps_to_first', () => {
    const e = setup(4);
    e.setOrder('shuffle');
    e.setRepeat('all');
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) seen.push(nextIndex(e));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    expect(nextIndex(e)).toBe(seen[0]);
  });

  it('shuffle_one_replays_current_on_end', () => {
    const e = setup(4);
    e.setOrder('shuffle');
    e.setRepeat('one');
    nextIndex(e);
    const current = e.currentIdx();
    expect(e.onTrackEnd()).toEqual({ type: 'replayCurrent' });
    expect(e.currentIdx()).toBe(current);
  });

  it('shuffle_is_deterministic_for_same_seed', () => {
    const e1 = setup(4);
    e1.setOrder('shuffle');
    e1.setRepeat('all');
    const e2 = setup(4);
    e2.setOrder('shuffle');
    e2.setRepeat('all');
    for (let i = 0; i < 4; i++) {
      expect(nextIndex(e1)).toBe(nextIndex(e2));
    }
  });

  it('shuffle_prev_returns_previously_played', () => {
    const e = setup(4);
    e.setOrder('shuffle');
    const first = nextIndex(e);
    nextIndex(e);
    expect(e.prev()!.track_id).toBe(first);
    expect(e.prev()!.track_id).toBe(0);
  });

  it('set_mode_shuffle_reanchors_at_current_index', () => {
    const e = setup(4);
    e.manualNext(); // sequential: 0 → 1
    e.setOrder('shuffle'); // 锚定在 index 1
    const idx = nextIndex(e);
    expect(idx).toBeLessThan(4);
    expect(idx).not.toBe(1);
    expect(e.prev()!.track_id).toBe(1);
  });

  it('set_mode_shuffle_again_rebuilds_navigation_in_range', () => {
    const e = setup(4);
    e.setOrder('shuffle');
    e.setRepeat('all');
    e.setOrder('shuffle'); // 重新随机
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) seen.push(nextIndex(e));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    expect(e.currentTrack()).not.toBeNull();
  });
});

describe('reshuffle 修复', () => {
  it('reshuffle_play_new_track_in_shuffle_keeps_navigation_valid', () => {
    const e = setup(4);
    e.setOrder('shuffle');
    e.playTrack(makeItem(99));
    expect(e.currentIdx()).toBe(0);
    expect(e.manualNext()).toEqual({ type: 'play', index: 0 });
    expect(e.currentTrack()).not.toBeNull();
  });

  it('reshuffle_play_existing_in_shuffle_syncs_position', () => {
    const e = setup(4);
    e.setOrder('shuffle');
    e.playTrack(makeItem(2));
    expect(e.currentIdx()).toBe(2);
    const idx = nextIndex(e);
    expect(idx).toBeLessThan(4);
    expect(idx).not.toBe(2);
    expect(e.prev()!.track_id).toBe(2);
  });

  it('reshuffle_remove_at_in_shuffle_stays_in_bounds', () => {
    const e = setup(4);
    e.setOrder('shuffle');
    nextIndex(e);
    const ci = e.currentIdx()!;
    expect(ci).not.toBe(0);
    e.removeAt(0);
    expect(e.currentIdx()).toBe(ci - 1);
    const idx = nextIndex(e);
    expect(idx).toBeLessThan(3);
    expect(e.currentTrack()).not.toBeNull();
  });

  it('reshuffle_append_in_shuffle_stays_in_bounds', () => {
    const e = setup(4);
    e.setOrder('shuffle');
    e.append([makeItem(4)]);
    expect(e.queueItems().length).toBe(5);
    const idx = nextIndex(e);
    expect(idx).toBeLessThan(5);
    expect(e.currentTrack()).not.toBeNull();
  });
});

describe('exit_fm 守卫', () => {
  it('exit_fm_on_non_fm_is_noop', () => {
    const e = setup(3);
    const before = e.currentTrack()!.track_id;
    const res = e.exitFm();
    expect(res).not.toBeNull();
    expect(res!.track_id).toBe(before);
    expect(e.isFmActive()).toBe(false);
    expect(e.queueItems().length).toBe(3);
    expect(e.currentIdx()).toBe(0);
  });
});

describe('队列操作：play_track / play_queue_at', () => {
  it('play_track_existing_jumps_without_duplicate', () => {
    const e = setup(4);
    e.playTrack(makeItem(3));
    expect(e.currentIdx()).toBe(3);
    expect(e.queueItems().length).toBe(4);
    expect(idsOf(e)).toEqual([0, 1, 2, 3]);
  });

  it('play_track_new_replaces_with_single_track', () => {
    const e = setup(4);
    e.playQueueAt(1);
    e.playTrack(makeItem(99));
    expect(idsOf(e)).toEqual([99]);
    expect(e.currentIdx()).toBe(0);
    expect(e.currentTrack()!.track_id).toBe(99);
  });

  it('play_track_on_empty_creates_single_track', () => {
    const e = new QueueEngine(1);
    e.playTrack(makeItem(5));
    expect(idsOf(e)).toEqual([5]);
    expect(e.currentIdx()).toBe(0);
  });

  it('play_track_exits_fm_and_discards_snapshot', () => {
    const e = setup(3);
    e.enterFm(makeItem(1));
    expect(e.isFmActive()).toBe(true);
    e.playTrack(makeItem(99));
    expect(e.isFmActive()).toBe(false);
    expect(e.currentTrack()!.track_id).toBe(99);
    expect(e.currentIdx()).toBe(0);
  });

  it('play_queue_at_jumps_and_rejects_out_of_range', () => {
    const e = setup(4);
    expect(e.playQueueAt(2)).not.toBeNull();
    expect(e.currentIdx()).toBe(2);
    expect(e.playQueueAt(4)).toBeNull();
    expect(e.playQueueAt(99)).toBeNull();
    expect(e.currentIdx()).toBe(2);
  });
});

describe('队列操作：replace_play', () => {
  it('replace_play_replaces_queue_and_starts_at_index', () => {
    const e = setup(3);
    const played = e.replacePlay([makeItem(10), makeItem(11), makeItem(12)], 1);
    expect(played!.track_id).toBe(11);
    expect(idsOf(e)).toEqual([10, 11, 12]);
    expect(e.currentIdx()).toBe(1);
    expect(e.currentTrack()!.track_id).toBe(11);
    expect(e.isFmActive()).toBe(false);
  });

  it('replace_play_empty_queue_returns_none_and_resets', () => {
    const e = setup(3);
    e.playQueueAt(2);
    expect(e.replacePlay([], null)).toBeNull();
    expect(e.queueItems().length).toBe(0);
    expect(e.currentIdx()).toBe(null);
    expect(e.currentTrack()).toBeNull();
  });

  it('replace_play_start_index_out_of_range_clamps', () => {
    const e = setup(3);
    const played = e.replacePlay(
      [makeItem(10), makeItem(11), makeItem(12)],
      99,
    );
    expect(played!.track_id).toBe(12);
    expect(e.currentIdx()).toBe(2);

    const e2 = setup(3);
    const played2 = e2.replacePlay(
      [makeItem(10), makeItem(11), makeItem(12)],
      null,
    );
    expect(played2!.track_id).toBe(10);
    expect(e2.currentIdx()).toBe(0);
  });

  it('replace_play_in_fm_exits_and_discards_snapshot', () => {
    const e = setup(3);
    e.playQueueAt(1);
    e.enterFm(makeItem(100));
    expect(e.isFmActive()).toBe(true);
    const played = e.replacePlay([makeItem(20), makeItem(21)], 1);
    expect(e.isFmActive()).toBe(false);
    expect(played!.track_id).toBe(21);
    expect(idsOf(e)).toEqual([20, 21]);
    expect(e.currentIdx()).toBe(1);
    expect(e.exitFm()).not.toBeNull();
    expect(idsOf(e)).toEqual([20, 21]);
  });

  it('replace_play_in_shuffle_navigates_after_call', () => {
    const e = setup(4);
    e.setOrder('shuffle');
    const played = e.replacePlay(items(5), 0);
    expect(played!.track_id).toBe(0);
    expect(e.order()).toBe('shuffle');
    expect(e.queueItems().length).toBe(5);
    const idx = nextIndex(e);
    expect(idx).toBeLessThan(5);
    expect(e.currentTrack()).not.toBeNull();
  });
});

describe('队列操作：append / insert_next', () => {
  it('append_keeps_current_position', () => {
    const e = setup(3);
    e.playQueueAt(1);
    e.append([makeItem(3)]);
    expect(idsOf(e)).toEqual([0, 1, 2, 3]);
    expect(e.currentIdx()).toBe(1);
    expect(e.currentTrack()!.track_id).toBe(1);
  });

  it('append_is_dupe_safe', () => {
    const e = setup(3);
    e.append([makeItem(1)]);
    expect(idsOf(e)).toEqual([0, 1, 2]);
    expect(e.queueItems().length).toBe(3);
  });

  it('append_to_empty_auto_plays', () => {
    const e = new QueueEngine(7);
    e.append([makeItem(7)]);
    expect(e.currentIdx()).toBe(0);
    expect(e.currentTrack()!.track_id).toBe(7);
  });

  it('append_batch_dedupes', () => {
    const e = setup(2);
    e.append([makeItem(2), makeItem(3), makeItem(2)]);
    expect(idsOf(e)).toEqual([0, 1, 2, 3]);
  });

  it('append_cross_batch_dedupes', () => {
    const e = new QueueEngine(11);
    e.append([makeItem(1), makeItem(2)]);
    e.append([makeItem(2), makeItem(3)]);
    expect(idsOf(e)).toEqual([1, 2, 3]);
    expect(e.queueItems().length).toBe(3);
  });

  it('insert_next_inserts_after_current', () => {
    const e = setup(4);
    e.playQueueAt(1);
    e.insertNext(makeItem(99));
    expect(idsOf(e)).toEqual([0, 1, 99, 2, 3]);
    expect(e.currentIdx()).toBe(1);
    expect(e.currentTrack()!.track_id).toBe(1);
  });

  it('insert_next_is_dupe_safe', () => {
    const e = setup(3);
    e.insertNext(makeItem(2));
    expect(idsOf(e)).toEqual([0, 1, 2]);
  });

  it('insert_next_into_empty_auto_plays', () => {
    const e = new QueueEngine(8);
    e.insertNext(makeItem(8));
    expect(e.currentIdx()).toBe(0);
    expect(e.currentTrack()!.track_id).toBe(8);
  });
});

describe('队列操作：remove_at / clear', () => {
  it('remove_at_before_current_decrements_index', () => {
    const e = setup(5);
    e.playQueueAt(3);
    e.removeAt(1);
    expect(idsOf(e)).toEqual([0, 2, 3, 4]);
    expect(e.currentIdx()).toBe(2);
    expect(e.currentTrack()!.track_id).toBe(3);
  });

  it('remove_at_current_keeps_index_next_slides_in', () => {
    const e = setup(5);
    e.playQueueAt(2);
    e.removeAt(2);
    expect(idsOf(e)).toEqual([0, 1, 3, 4]);
    expect(e.currentIdx()).toBe(2);
    expect(e.currentTrack()!.track_id).toBe(3);
  });

  it('remove_at_current_last_clamps_to_new_end', () => {
    const e = setup(4);
    e.playQueueAt(3);
    e.removeAt(3);
    expect(idsOf(e)).toEqual([0, 1, 2]);
    expect(e.currentIdx()).toBe(2);
    expect(e.currentTrack()!.track_id).toBe(2);
  });

  it('remove_at_after_current_leaves_index', () => {
    const e = setup(5);
    e.playQueueAt(1);
    e.removeAt(3);
    expect(idsOf(e)).toEqual([0, 1, 2, 4]);
    expect(e.currentIdx()).toBe(1);
  });

  it('remove_at_out_of_range_is_noop', () => {
    const e = setup(3);
    e.playQueueAt(1);
    e.removeAt(3);
    e.removeAt(99);
    expect(idsOf(e)).toEqual([0, 1, 2]);
    expect(e.currentIdx()).toBe(1);
  });

  it('remove_at_last_remaining_empties_queue', () => {
    const e = setup(1);
    e.removeAt(0);
    expect(e.queueItems().length).toBe(0);
    expect(e.currentIdx()).toBe(null);
    expect(e.currentTrack()).toBeNull();
  });

  it('clear_empties_queue_and_resets_index', () => {
    const e = setup(4);
    e.playQueueAt(2);
    e.clear();
    expect(e.queueItems().length).toBe(0);
    expect(e.currentIdx()).toBe(null);
    expect(e.currentTrack()).toBeNull();
  });

  it('clear_exits_fm_and_discards_snapshot', () => {
    const e = setup(3);
    e.enterFm(makeItem(1));
    e.clear();
    expect(e.isFmActive()).toBe(false);
    expect(e.queueItems().length).toBe(0);
  });
});

describe('FM 状态机（多曲流式模型）', () => {
  it('fm_full_flow_streaming_model', () => {
    const e = setup(3);
    e.playQueueAt(1);
    e.enterFm(makeItem(100));
    expect(e.isFmActive()).toBe(true);
    expect(idsOf(e)).toEqual([100]);
    expect(e.currentIdx()).toBe(0);
    expect(e.currentTrack()!.track_id).toBe(100);

    expect(e.manualNext()).toEqual({ type: 'end' });

    e.fmRecordPlayed();
    expect(e.snapshot().fm_played_ids).toEqual([100]);

    e.appendFm([makeItem(101), makeItem(102)]);
    expect(idsOf(e)).toEqual([100, 101, 102]);
    expect(e.manualNext()).toEqual({ type: 'play', index: 1 });
    expect(e.currentTrack()!.track_id).toBe(101);

    const restored = e.exitFm()!;
    expect(restored.track_id).toBe(1);
    expect(e.isFmActive()).toBe(false);
    expect(e.order()).toBe('sequential');
    expect(e.currentIdx()).toBe(1);
    expect(idsOf(e)).toEqual([0, 1, 2]);
  });

  it('fm_loop_one_keeps_current_track', () => {
    const e = setup(3);
    e.playQueueAt(1);
    e.setRepeat('one');
    e.enterFm(makeItem(100));
    expect(e.isFmActive()).toBe(true);
    expect(e.manualNext()).toEqual({ type: 'play', index: 0 });
    expect(e.onTrackEnd()).toEqual({ type: 'replayCurrent' });
    expect(e.currentTrack()!.track_id).toBe(100);
    const restored = e.exitFm()!;
    expect(restored.track_id).toBe(1);
    expect(e.isFmActive()).toBe(false);
    expect(e.repeat()).toBe('one');
    expect(e.currentIdx()).toBe(1);
  });

  it('enter_fm_reentry_keeps_original_snapshot', () => {
    const e = setup(3);
    e.playQueueAt(1);
    e.enterFm(makeItem(100));
    e.enterFm(makeItem(200));
    expect(e.isFmActive()).toBe(true);
    expect(e.currentTrack()!.track_id).toBe(200);
    const restored = e.exitFm()!;
    expect(restored.track_id).toBe(1);
    expect(e.currentIdx()).toBe(1);
    expect(idsOf(e)).toEqual([0, 1, 2]);
  });

  it('enter_fm_from_empty_queue_exit_empties', () => {
    const e = new QueueEngine(5);
    e.enterFm(makeItem(100));
    expect(e.isFmActive()).toBe(true);
    expect(e.exitFm()).toBeNull();
    expect(e.queueItems().length).toBe(0);
    expect(e.currentIdx()).toBe(null);
  });

  it('append_in_fm_exits_fm_restores_then_appends', () => {
    const e = setup(3);
    e.playQueueAt(1);
    e.append([makeItem(3)]);
    e.enterFm(makeItem(100));
    expect(e.isFmActive()).toBe(true);
    e.append([makeItem(9)]);
    expect(e.isFmActive()).toBe(false);
    expect(idsOf(e)).toEqual([0, 1, 2, 3, 9]);
    expect(e.currentIdx()).toBe(1);
    expect(e.currentTrack()!.track_id).toBe(1);
  });

  it('insert_next_in_fm_exits_fm_first', () => {
    const e = setup(3);
    e.playQueueAt(1);
    e.enterFm(makeItem(100));
    e.insertNext(makeItem(99));
    expect(e.isFmActive()).toBe(false);
    expect(e.currentIdx()).toBe(1);
    expect(idsOf(e)).toEqual([0, 1, 99, 2]);
  });

  it('play_queue_at_in_fm_exits_fm_first', () => {
    const e = setup(3);
    e.playQueueAt(1);
    e.enterFm(makeItem(100));
    expect(e.isFmActive()).toBe(true);
    const played = e.playQueueAt(2);
    expect(e.isFmActive()).toBe(false);
    expect(played!.track_id).toBe(2);
    expect(e.currentIdx()).toBe(2);
    expect(idsOf(e)).toEqual([0, 1, 2]);
  });

  it('remove_at_in_fm_exits_fm_first', () => {
    const e = setup(3);
    e.playQueueAt(1);
    e.enterFm(makeItem(100));
    expect(e.isFmActive()).toBe(true);
    e.removeAt(0);
    expect(e.isFmActive()).toBe(false);
    expect(idsOf(e)).toEqual([1, 2]);
    expect(e.currentIdx()).toBe(0);
    expect(e.currentTrack()!.track_id).toBe(1);
  });

  it('append_fm_non_fm_is_noop', () => {
    const e = setup(2);
    e.appendFm([makeItem(99)]);
    expect(e.isFmActive()).toBe(false);
    expect(idsOf(e)).toEqual([0, 1]);
    expect(e.currentIdx()).toBe(0);
    expect(e.currentTrack()!.track_id).toBe(0);
  });

  it('fm_record_played_non_fm_is_noop', () => {
    const e = setup(2);
    e.fmRecordPlayed();
    expect(e.isFmActive()).toBe(false);
    expect(e.snapshot().fm_played_ids).toEqual([]);
    expect(idsOf(e)).toEqual([0, 1]);
  });
});

describe('快照', () => {
  it('snapshot_roundtrip_restores_state', () => {
    const e = setup(4);
    e.playQueueAt(2);
    e.setOrder('shuffle');
    const snap = e.snapshot();
    const restored = QueueEngine.fromSnapshot(snap);
    expect(restored.snapshot()).toEqual(e.snapshot());
    expect(restored.currentIdx()).toBe(2);
    expect(restored.currentTrack()!.track_id).toBe(2);
    expect(restored.order()).toBe('shuffle');
    expect(restored.isFmActive()).toBe(false);
    const idx = nextIndex(restored);
    expect(idx).toBeLessThan(4);
  });

  it('snapshot_roundtrip_fm_preserves_played_ids', () => {
    const e = setup(4);
    e.enterFm(makeItem(100));
    e.fmRecordPlayed();
    e.appendFm([makeItem(200)]);
    const snap = e.snapshot();
    expect(snap.content_source).toBe('personal_fm');
    expect(snap.fm_played_ids).toEqual([100]);
    expect(snap.queue.length).toBe(2);
    const restored = QueueEngine.fromSnapshot(snap);
    expect(restored.isFmActive()).toBe(true);
    expect(restored.currentTrack()!.track_id).toBe(100);
    expect(restored.snapshot().fm_played_ids).toEqual([100]);
    expect(restored.manualNext()).toEqual({ type: 'play', index: 1 });
  });

  it('snapshot_json_roundtrip', () => {
    const e = setup(3);
    e.playQueueAt(1);
    e.setRepeat('one');
    const snap = e.snapshot();
    const back: PlayerSnapshot = JSON.parse(JSON.stringify(snap));
    expect(back).toEqual(snap);
  });

  it('from_snapshot_out_of_range_index_is_clamped', () => {
    const snap: PlayerSnapshot = {
      queue: items(2),
      current_index: 5,
      order: 'sequential',
      repeat: 'off',
      content_source: 'queue',
      fm_played_ids: [],
    };
    const e = QueueEngine.fromSnapshot(snap);
    expect(e.currentIdx()).toBe(null);
    expect(e.currentTrack()).toBeNull();
    expect(e.queueItems().length).toBe(2);
  });
});

describe('边界：空队列 / 单曲队列 / 越界', () => {
  it('empty_queue_navigation', () => {
    const e = setup(0);
    expect(e.manualNext()).toEqual({ type: 'end' });
    expect(e.prev()).toBeNull();
    expect(e.currentIdx()).toBe(null);
    expect(e.currentTrack()).toBeNull();
  });

  it('empty_queue_any_mode_ends', () => {
    const orders: Order[] = ['sequential', 'shuffle'];
    const repeats: Repeat[] = ['off', 'all', 'one'];
    for (const order of orders) {
      for (const repeat of repeats) {
        const e = setup(0);
        e.setOrder(order);
        e.setRepeat(repeat);
        expect(e.manualNext()).toEqual({ type: 'end' });
      }
    }
  });

  it('single_track_sequential_next_wraps_to_self', () => {
    const e = setup(1);
    expect(e.currentIdx()).toBe(0);
    expect(e.manualNext()).toEqual({ type: 'play', index: 0 });
    expect(e.currentIdx()).toBe(0);
    expect(e.prev()!.track_id).toBe(0);
  });

  it('single_track_loop_one_keeps_current', () => {
    const e = setup(1);
    e.setRepeat('one');
    expect(e.manualNext()).toEqual({ type: 'play', index: 0 });
    expect(e.onTrackEnd()).toEqual({ type: 'replayCurrent' });
    expect(e.prev()!.track_id).toBe(0);
  });

  it('single_track_shuffle_all_wraps_to_self', () => {
    const e = setup(1);
    e.setOrder('shuffle');
    e.setRepeat('all');
    expect(e.manualNext()).toEqual({ type: 'play', index: 0 });
    expect(e.currentTrack()!.track_id).toBe(0);
  });

  it('play_queue_at_out_of_range_rejected', () => {
    const e = setup(4);
    expect(e.playQueueAt(4)).toBeNull();
    expect(e.playQueueAt(99)).toBeNull();
    expect(e.currentTrack()).not.toBeNull();
  });
});
