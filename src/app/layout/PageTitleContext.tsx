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

interface PageTitleState {
  title: string;
}

const PageTitleContext = createContext<PageTitleState>({ title: "" });

const SetTitleContext = createContext<
  (pathname: string, title: string | undefined) => void
>(() => {});

/**
 * Read or set the page title for the current route.
 * - `usePageTitle("标题")` — register the title (auto-clears when page hides via keepalive)
 * - `usePageTitle()` — read current title (used by layout/header)
 */
export function usePageTitle(title?: string) {
  const location = useLocation();
  const setTitle = useContext(SetTitleContext);
  const pathname = location.pathname;

  useEffectOnActive(() => {
    if (title !== undefined) {
      setTitle(pathname, title);
      return () => setTitle(pathname, undefined);
    }
  }, [title, pathname, setTitle]);

  return useContext(PageTitleContext);
}

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [title, setTitleState] = useState("");
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  // Guard with pathRef so a stale cleanup from a hidden keepalive page
  // can't clear the title of the currently active page.
  const setTitle = useCallback(
    (pathname: string, value: string | undefined) => {
      if (pathname !== pathRef.current) return;
      setTitleState(value ?? "");
    },
    [],
  );

  const pageValue = useMemo<PageTitleState>(() => ({ title }), [title]);

  return (
    <SetTitleContext.Provider value={setTitle}>
      <PageTitleContext.Provider value={pageValue}>
        {children}
      </PageTitleContext.Provider>
    </SetTitleContext.Provider>
  );
}
