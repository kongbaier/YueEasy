import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { ImageDecodeResult } from '@/shared/utils/image';
import { decodeImage } from '@/shared/utils/image';

export interface UseDecodedSrcOptions {
  /**
   * 延迟到进入视口附近（含轮播相邻 slide）才开始预加载+解码。
   * 默认 false：挂载即解码。大量离屏图片（轮播全量挂载）传 true，
   * 避免同时解码、白白占用 GPU 纹理。
   */
  lazy?: boolean;
  /**
   * 解码/加载失败时是否仍把原 src 视为可绘制（避免永久占位）。
   * 默认 true：失败也显示原图，让浏览器自绘错误占位。
   */
  fallbackOnError?: boolean;
}

export interface UseDecodedSrcResult<T extends HTMLElement> {
  /** 挂到占位容器元素上（lazy 时由它触发 IntersectionObserver） */
  ref: RefObject<T | null>;
  /**
   * 已完整解码、可安全挂到 `<img>` 的 src。
   * 新图解码期间**保留旧值**（调用方据此原地替换或交叉淡出，不出现占位空窗）。
   */
  decodedSrc: string | undefined;
  /** 当前 src 是否已可绘制（`decodedSrc === src`） */
  isReady: boolean;
}

/**
 * 「先离屏解码、再绘制」的共享状态机。
 *
 * DecodedImage（原地替换）、CrossfadeImage（交叉淡出）、播放页预加载共用同一套
 * 解码语义：decode 特性检测、错误回退、lazy 提前量只在本文件定义一处。
 *
 * 调用方只负责决定「怎么用 decodedSrc 呈现」，不重复实现解码。
 */
export function useDecodedSrc<T extends HTMLElement = HTMLDivElement>(
  src: string,
  { lazy = false, fallbackOnError = true }: UseDecodedSrcOptions = {},
): UseDecodedSrcResult<T> {
  const [decodedSrc, setDecodedSrc] = useState<string>();
  const ref = useRef<T>(null);

  useEffect(() => {
    let cancelled = false;

    const markReady = (result: ImageDecodeResult) => {
      if (cancelled) return;
      if (result === 'error' && !fallbackOnError) return;
      setDecodedSrc(src);
    };

    const preload = () => {
      void decodeImage(src).then(markReady);
    };

    if (!lazy) {
      preload();
      return () => {
        cancelled = true;
      };
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            preload();
          }
        }
      },
      // 200px 提前量：相邻 slide 滑进前就开始解码，保证切到时已就绪
      { rootMargin: '200px' },
    );
    observer.observe(el);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [src, fallbackOnError, lazy]);

  return { ref, decodedSrc, isReady: decodedSrc === src };
}
