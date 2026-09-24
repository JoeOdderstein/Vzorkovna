export function openRemotePopupWindow(path: string, windowName: string) {
  const width = 1100;
  const height = 720;
  const left = Math.max(0, window.screenX + Math.round((window.outerWidth - width) / 2));
  const top = Math.max(0, window.screenY + 80);
  const features = [
    'popup=yes',
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'resizable=yes',
    'scrollbars=yes',
    'toolbar=yes',
    'menubar=no',
  ].join(',');

  const popup = window.open(path, windowName, features);
  if (!popup) {
    window.open(path, '_blank');
    return;
  }

  popup.focus();
}
