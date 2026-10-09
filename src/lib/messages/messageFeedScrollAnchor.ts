let suppressAutoScrollUntil = 0;

/** While true, MessagesPanel must not pin the feed to the bottom on resize (e.g. message expand). */
export function suppressFeedAutoScroll(durationMs = 1600) {
  suppressAutoScrollUntil = performance.now() + durationMs;
}

export function isFeedAutoScrollSuppressed() {
  return performance.now() < suppressAutoScrollUntil;
}

export function getMessagesFeedScrollParent(from: Element): HTMLElement | null {
  const el = from.closest('.tb-messages-feed');
  return el instanceof HTMLElement ? el : null;
}

export type FeedScrollAnchorPin = {
  scrollEl: HTMLElement;
  anchorEl: HTMLElement;
  /** Distance from anchor top to scroll container top (client coords), captured before expand. */
  desiredOffsetTop: number;
};

export function captureFeedScrollAnchorPin(anchorEl: HTMLElement): FeedScrollAnchorPin | null {
  const scrollEl = getMessagesFeedScrollParent(anchorEl);
  if (!scrollEl) return null;
  const scrollRect = scrollEl.getBoundingClientRect();
  const desiredOffsetTop = anchorEl.getBoundingClientRect().top - scrollRect.top;
  return { scrollEl, anchorEl, desiredOffsetTop };
}

export function applyFeedScrollAnchorPin(pin: FeedScrollAnchorPin) {
  const scrollRect = pin.scrollEl.getBoundingClientRect();
  const drift =
    pin.anchorEl.getBoundingClientRect().top - scrollRect.top - pin.desiredOffsetTop;
  if (Math.abs(drift) > 0.5) {
    pin.scrollEl.scrollTop += drift;
  }
}

export function scheduleFeedScrollAnchorPin(pin: FeedScrollAnchorPin) {
  suppressFeedAutoScroll();
  applyFeedScrollAnchorPin(pin);
  requestAnimationFrame(() => {
    applyFeedScrollAnchorPin(pin);
    requestAnimationFrame(() => applyFeedScrollAnchorPin(pin));
  });
}
