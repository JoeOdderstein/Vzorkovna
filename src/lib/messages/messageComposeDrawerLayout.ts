import {
  clampMessageComposeDrawerWidth,
  messageComposeDrawerShouldOverlay,
} from './messageComposeDrawerWidth';

/** Sync layout push vs full-screen overlay while dragging (avoids waiting for React). */
export function applyMessageComposeDrawerLayout(width: number): void {
  const clamped = clampMessageComposeDrawerWidth(width);
  const overlay = messageComposeDrawerShouldOverlay(window.innerWidth, width);
  const layout = document.querySelector('.tb-layout-push');
  const drawer = document.querySelector('.tb-messages-compose-drawer');

  if (overlay) {
    layout?.classList.remove('tb-layout-push--open');
    layout?.style.removeProperty('--tb-drawer-width');
    drawer?.classList.add('tb-messages-compose-drawer--overlay');
    drawer?.style.removeProperty('--tb-drawer-width');
  } else {
    const px = `${clamped}px`;
    layout?.classList.add('tb-layout-push--open');
    layout?.style.setProperty('--tb-drawer-width', px);
    drawer?.classList.remove('tb-messages-compose-drawer--overlay');
    drawer?.style.setProperty('--tb-drawer-width', px);
  }
}

export function clearMessageComposeDrawerLayoutOverrides(): void {
  document.querySelector('.tb-layout-push')?.style.removeProperty('--tb-drawer-width');
  document.querySelector('.tb-messages-compose-drawer')?.style.removeProperty('--tb-drawer-width');
}
