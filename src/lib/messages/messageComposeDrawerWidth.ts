/** Default matches `--tb-drawer-width: 28rem` in CSS. */
export const MESSAGE_COMPOSE_DRAWER_WIDTH_DEFAULT = 448;
export const MESSAGE_COMPOSE_DRAWER_WIDTH_MIN = 448;
export const MESSAGE_COMPOSE_DRAWER_WIDTH_MAX = 720;

/** Minimum width left for the message feed before compose goes full-screen (desktop). */
export const MESSAGE_COMPOSE_MIN_FEED_WIDTH = 380;

/** Used while dragging with the raw (unclamped) width. */
export function messageComposeDrawerShouldOverlay(
  viewportWidth: number,
  drawerWidth: number,
): boolean {
  if (viewportWidth < 768) return false;
  const w = Math.max(MESSAGE_COMPOSE_DRAWER_WIDTH_MIN, Math.round(drawerWidth));
  if (viewportWidth - w < MESSAGE_COMPOSE_MIN_FEED_WIDTH) return true;
  // Wide screens: side-by-side drawer is capped at MAX; widening further goes full-screen.
  if (w > MESSAGE_COMPOSE_DRAWER_WIDTH_MAX) return true;
  return false;
}

export function messageComposeDrawerOverlaysFeed(
  viewportWidth: number,
  drawerWidth: number,
  overlayExpanded = false,
): boolean {
  if (viewportWidth < 768) return false;
  if (overlayExpanded) return true;
  return messageComposeDrawerShouldOverlay(
    viewportWidth,
    clampMessageComposeDrawerWidth(drawerWidth),
  );
}

/** Persist full-screen when user dragged past the side drawer cap on a wide viewport. */
export function messageComposeDrawerNeedsExpandedOverlay(
  viewportWidth: number,
  rawDrawerWidth: number,
): boolean {
  if (viewportWidth < 768) return false;
  if (rawDrawerWidth <= MESSAGE_COMPOSE_DRAWER_WIDTH_MAX) return false;
  const clamped = clampMessageComposeDrawerWidth(rawDrawerWidth);
  return !messageComposeDrawerShouldOverlay(viewportWidth, clamped);
}

const STORAGE_KEY = 'tb_message_compose_drawer_width_v1';

export function clampMessageComposeDrawerWidth(width: number): number {
  return Math.round(
    Math.min(MESSAGE_COMPOSE_DRAWER_WIDTH_MAX, Math.max(MESSAGE_COMPOSE_DRAWER_WIDTH_MIN, width)),
  );
}

export function loadMessageComposeDrawerWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return MESSAGE_COMPOSE_DRAWER_WIDTH_DEFAULT;
    const n = Number(raw);
    if (!Number.isFinite(n)) return MESSAGE_COMPOSE_DRAWER_WIDTH_DEFAULT;
    return clampMessageComposeDrawerWidth(n);
  } catch {
    return MESSAGE_COMPOSE_DRAWER_WIDTH_DEFAULT;
  }
}

export function saveMessageComposeDrawerWidth(width: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clampMessageComposeDrawerWidth(width)));
  } catch {
    /* ignore */
  }
}
