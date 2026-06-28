import { useEffectOnActive } from "keepalive-for-react";
import { createContext, useCallback, useContext, useState } from "react";
import { useLocation } from "react-router-dom";

interface BreadcrumbEntry {
  pathname: string;
  segment: string;
}

interface PageTitleContextValue {
  breadcrumbs: BreadcrumbEntry[];
  pushBreadcrumb: (pathname: string, segment: string, root?: boolean) => void;
}

const PageTitleContext = createContext<PageTitleContextValue>({
  breadcrumbs: [],
  pushBreadcrumb: () => {},
});

interface UsePageTitleOptions {
  /** Replace the entire breadcrumb trail (for top-level / sidebar pages). */
  root?: boolean;
}

/**
 * Register a breadcrumb segment for the current route.
 *
 * - `usePageTitle("发现", { root: true })` — top-level page, replaces all previous breadcrumbs
 * - `usePageTitle("歌单名")` — detail page, appends to the existing trail
 * - `usePageTitle()` — read current breadcrumbs (used by layout/header)
 */
export function usePageTitle(segment?: string, opts?: UsePageTitleOptions) {
  const location = useLocation();
  const { pushBreadcrumb, breadcrumbs } = useContext(PageTitleContext);
  const pathname = location.pathname;

  useEffectOnActive(() => {
    if (segment !== undefined) {
      pushBreadcrumb(pathname, segment, opts?.root);
    }
  }, [segment, pathname, pushBreadcrumb, opts?.root]);

  return { breadcrumbs };
}

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<BreadcrumbEntry[]>([]);

  const pushBreadcrumb = useCallback(
    (pathname: string, segment: string, root?: boolean) => {
      setStack((prev) => {
        if (root) {
          return [{ pathname, segment }];
        }
        const idx = prev.findIndex((e) => e.pathname === pathname);
        if (idx >= 0) {
          return [...prev.slice(0, idx), { pathname, segment }];
        }
        return [...prev, { pathname, segment }];
      });
    },
    [],
  );

  return (
    <PageTitleContext.Provider value={{ breadcrumbs: stack, pushBreadcrumb }}>
      {children}
    </PageTitleContext.Provider>
  );
}
