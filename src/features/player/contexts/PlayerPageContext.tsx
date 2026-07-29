import { createContext, useCallback, useContext, useState } from "react";

interface PlayerPageContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const PlayerPageContext = createContext<PlayerPageContextValue | null>(null);

export function PlayerPageProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <PlayerPageContext.Provider value={{ isOpen, open, close }}>
      {children}
    </PlayerPageContext.Provider>
  );
}

export function usePlayerPage(): PlayerPageContextValue {
  const ctx = useContext(PlayerPageContext);
  if (!ctx) throw new Error("usePlayerPage must be used within PlayerPageProvider");
  return ctx;
}
