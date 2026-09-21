import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

interface PlayerPageContextValue {
  isOpen: boolean;
  open: () => void;
  /**
   * 关闭播放页。传入 afterClose 时，会在退出动画结束后执行它
   * （用于"先关页面、动画结束再改队列"的操作，如清空播放列表）。
   */
  close: (afterClose?: () => void) => void;
  /** 由 PlayerPage 在 AnimatePresence 退出动画完成时调用，执行并清空挂起的 afterClose。 */
  runAfterExit: () => void;
}

const PlayerPageContext = createContext<PlayerPageContextValue | null>(null);

export function PlayerPageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const afterCloseRef = useRef<(() => void) | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback((afterClose?: () => void) => {
    afterCloseRef.current = afterClose ?? null;
    setIsOpen(false);
  }, []);
  const runAfterExit = useCallback(() => {
    const fn = afterCloseRef.current;
    afterCloseRef.current = null;
    fn?.();
  }, []);

  const value = useMemo(
    () => ({ isOpen, open, close, runAfterExit }),
    [isOpen, open, close, runAfterExit],
  );

  return (
    <PlayerPageContext.Provider value={value}>
      {children}
    </PlayerPageContext.Provider>
  );
}

export function usePlayerPage(): PlayerPageContextValue {
  const ctx = useContext(PlayerPageContext);
  if (!ctx)
    throw new Error('usePlayerPage must be used within PlayerPageProvider');
  return ctx;
}
