import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type MessagesComposeContextValue = {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  /** Called synchronously before the compose drawer opens (preserve feed scroll). */
  notifyComposeWillOpen: () => void;
  setComposeWillOpenHandler: (handler: (() => void) | null) => void;
};

const MessagesComposeContext = createContext<MessagesComposeContextValue | null>(null);

export function MessagesComposeProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const composeWillOpenHandlerRef = useRef<(() => void) | null>(null);

  const setComposeWillOpenHandler = useCallback((handler: (() => void) | null) => {
    composeWillOpenHandlerRef.current = handler;
  }, []);

  const notifyComposeWillOpen = useCallback(() => {
    composeWillOpenHandlerRef.current?.();
  }, []);

  const value = useMemo(
    () => ({
      drawerOpen,
      setDrawerOpen,
      notifyComposeWillOpen,
      setComposeWillOpenHandler,
    }),
    [drawerOpen, notifyComposeWillOpen, setComposeWillOpenHandler]
  );
  return (
    <MessagesComposeContext.Provider value={value}>{children}</MessagesComposeContext.Provider>
  );
}

export function useMessagesCompose() {
  const ctx = useContext(MessagesComposeContext);
  if (!ctx) {
    return {
      drawerOpen: false,
      setDrawerOpen: () => {},
      notifyComposeWillOpen: () => {},
      setComposeWillOpenHandler: () => {},
    };
  }
  return ctx;
}
