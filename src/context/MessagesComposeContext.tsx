import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  clampMessageComposeDrawerWidth,
  loadMessageComposeDrawerWidth,
  messageComposeDrawerNeedsExpandedOverlay,
  messageComposeDrawerOverlaysFeed,
  saveMessageComposeDrawerWidth,
} from '../lib/messages/messageComposeDrawerWidth';

type MessagesComposeContextValue = {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  drawerWidth: number;
  setDrawerWidth: (width: number) => void;
  commitComposeDrawerResize: (rawWidth: number) => void;
  /** Desktop: compose covers the screen when the feed would become too narrow. */
  drawerOverlaysFeed: boolean;
  /** Called synchronously before the compose drawer opens (preserve feed scroll). */
  notifyComposeWillOpen: () => void;
  setComposeWillOpenHandler: (handler: (() => void) | null) => void;
};

const MessagesComposeContext = createContext<MessagesComposeContextValue | null>(null);

export function MessagesComposeProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpenState] = useState(false);
  const [drawerWidth, setDrawerWidthState] = useState(() => loadMessageComposeDrawerWidth());
  /** Full-screen compose after dragging wider than the side drawer cap (wide desktops). */
  const [drawerOverlayExpanded, setDrawerOverlayExpanded] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  );
  const composeWillOpenHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const drawerOverlaysFeed =
    drawerOpen &&
    messageComposeDrawerOverlaysFeed(viewportWidth, drawerWidth, drawerOverlayExpanded);

  const setDrawerOpen = useCallback((open: boolean) => {
    setDrawerOpenState(open);
    if (!open) setDrawerOverlayExpanded(false);
  }, []);

  const setDrawerWidth = useCallback((width: number) => {
    const clamped = clampMessageComposeDrawerWidth(width);
    setDrawerWidthState(clamped);
    saveMessageComposeDrawerWidth(clamped);
  }, []);

  const commitComposeDrawerResize = useCallback((rawWidth: number) => {
    const clamped = clampMessageComposeDrawerWidth(rawWidth);
    const vw = typeof window !== 'undefined' ? window.innerWidth : viewportWidth;
    setDrawerOverlayExpanded(messageComposeDrawerNeedsExpandedOverlay(vw, rawWidth));
    setDrawerWidthState(clamped);
    saveMessageComposeDrawerWidth(clamped);
  }, [viewportWidth]);

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
      drawerWidth,
      setDrawerWidth,
      commitComposeDrawerResize,
      drawerOverlaysFeed,
      notifyComposeWillOpen,
      setComposeWillOpenHandler,
    }),
    [
      drawerOpen,
      drawerWidth,
      drawerOverlaysFeed,
      setDrawerOpen,
      setDrawerWidth,
      commitComposeDrawerResize,
      notifyComposeWillOpen,
      setComposeWillOpenHandler,
    ]
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
      drawerWidth: loadMessageComposeDrawerWidth(),
      setDrawerWidth: () => {},
      commitComposeDrawerResize: () => {},
      drawerOverlaysFeed: false,
      notifyComposeWillOpen: () => {},
      setComposeWillOpenHandler: () => {},
    };
  }
  return ctx;
}
