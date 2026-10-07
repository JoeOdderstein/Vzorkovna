/** Stable hue (0–359) from login username — same person, same color site-wide. */
export function commentAuthorHue(username: string): number {
  const normalized = String(username ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return 220;

  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
