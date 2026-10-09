export const TASKBOARD_DRIVE_FOLDER_ID = '1j2VboQ-Y48m_PBNC--qjDqDDob-pL5JV';

export const TASKBOARD_DRIVE_URL = `https://drive.google.com/drive/folders/${TASKBOARD_DRIVE_FOLDER_ID}?usp=drive_link`;

export const TASKBOARD_PATH = '/taskboard';

export const PROJECTS_PATH = '/projects';

export const MESSAGES_PATH = '/messages';

export const INVOICES_PATH = '/invoices';

export const CALENDAR_PATH = '/calendar';

export function installationDetailPath(installationId: string) {
  return `${PROJECTS_PATH}/installation/${installationId}`;
}

export function canAccessTaskboardPrivateNav(username: string | null, isAdmin: boolean) {
  if (isAdmin) return true;
  return username?.toLowerCase() === 'gus';
}
