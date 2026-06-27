import { useEffectOnActive } from "keepalive-for-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

/** Route → default title. Covers all static pages. */
const ROUTE_TITLES: Record<string, string> = {
  "/": "发现",
  "/search": "搜索",
  "/daily": "每日推荐",
  "/my/liked": "我的喜欢",
  "/my/recent": "最近播放",
  "/settings": "设置",
};

interface PageTitleState {
  /** Current page title (resolved from route default + per-path override) */
  title: string;
}

const PageTitleContext = createContext<PageTitleState>({
  title: "",
});

const SetTitleContext = createContext<
  (pathname: string, title: string | undefined) => void
>(() => {});

/**
 * Set the page title for the current route. Pass `undefined` to clear.
 *
 * Uses `useEffectOnActive` so the title is automatically cleared when
 * the page becomes hidden (keepalive caches instead of unmounting) and
 * re-applied when the page becomes visible again.
 */
export function usePageTitle(override?: string) {
  const location = useLocation();
  const setTitle = useContext(SetTitleContext);
  // Capture the route pathname at render time — this is the route this
  // page "owns", so all set/clear calls target this slot.
  const pathname = location.pathname;

  useEffectOnActive(() => {
    if (override !== undefined) {
      setTitle(pathname, override);
      return () => setTitle(pathname, undefined);
    }
  }, [override, pathname, setTitle]);

  return useContext(PageTitleContext);
}

export function PageTitleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const defaultTitle = ROUTE_TITLES[location.pathname] ?? "";

  // Guard: setTitle is called with the pathname captured by usePageTitle
  // at render time, so each route writes into its own slot — no cross-talk.
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  const setTitle = useCallback(
    (pathname: string, title: string | undefined) => {
      setOverrides((prev) => {
        if (title === undefined) {
          if (!(pathname in prev)) return prev;
          const next = { ...prev };
          delete next[pathname];
          return next;
        }
        if (prev[pathname] === title) return prev;
        return { ...prev, [pathname]: title };
      });
    },
    [],
  );

  const title = overrides[location.pathname] ?? defaultTitle;

  const pageValue = useMemo<PageTitleState>(() => ({ title }), [title]);

  return (
    <SetTitleContext.Provider value={setTitle}>
      <PageTitleContext.Provider value={pageValue}>
        {children}
      </PageTitleContext.Provider>
    </SetTitleContext.Provider>
  );
}
