import { Resend } from 'resend';

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

const GOOGLE_CALENDAR_TIMEZONE =
  process.env.CALENDAR_TIMEZONE?.trim() || 'Europe/Amsterdam';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHref(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function normalizeDeadlineDate(deadline) {
  if (!deadline) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(deadline));
  return match ? match[1] : null;
}

function formatDeadline(deadline) {
  const dateKey = normalizeDeadlineDate(deadline);
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function googleCalendarAllDayDates(deadline) {
  const dateKey = normalizeDeadlineDate(deadline);
  if (!dateKey) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const start = `${match[1]}${match[2]}${match[3]}`;
  const endDate = new Date(year, month - 1, day + 1);
  const end = [
    endDate.getFullYear(),
    String(endDate.getMonth() + 1).padStart(2, '0'),
    String(endDate.getDate()).padStart(2, '0'),
  ].join('');

  return `${start}/${end}`;
}

export function buildGoogleCalendarUrl({
  taskName,
  description,
  projectName,
  deadline,
  taskUrl,
  assignedBy,
}) {
  const params = new URLSearchParams({ action: 'TEMPLATE' });
  params.set('text', taskName || 'Taskboard task');
  params.set('ctz', GOOGLE_CALENDAR_TIMEZONE);

  const details = [];
  const trimmedDescription = typeof description === 'string' ? description.trim() : '';
  if (trimmedDescription) {
    details.push(trimmedDescription);
    details.push('');
  }
  details.push(`Project: ${projectName || 'Taskboard'}`);
  details.push(`Assigned by: ${assignedBy || 'Someone'}`);
  if (taskUrl) details.push(`Open task: ${taskUrl}`);
  params.set('details', details.join('\n'));

  const dates = deadline ? googleCalendarAllDayDates(deadline) : null;
  if (dates) params.set('dates', dates);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildAssignmentHtml({
  assigneeName,
  assignedBy,
  taskName,
  description,
  projectName,
  deadline,
  taskUrl,
}) {
  const deadlineLine = deadline
    ? `<p style="margin:0 0 16px;color:#444;">Deadline: <strong>${formatDeadline(deadline)}</strong></p>`
    : '';

  const googleCalendarUrl = buildGoogleCalendarUrl({
    taskName,
    description,
    projectName,
    deadline,
    taskUrl,
    assignedBy,
  });

  const trimmedDescription = typeof description === 'string' ? description.trim() : '';
  const descriptionBlock = trimmedDescription
    ? `<div style="margin:0 0 16px;color:#444;">
        <p style="margin:0 0 6px;font-size:14px;color:#666;">Description</p>
        <p style="margin:0;white-space:pre-wrap;">${escapeHtml(trimmedDescription)}</p>
      </div>`
    : '';

  const safeAssigneeName = escapeHtml(assigneeName);
  const safeAssignedBy = escapeHtml(assignedBy);
  const safeTaskName = escapeHtml(taskName);
  const safeProjectName = escapeHtml(projectName);
  const safeTaskUrl = taskUrl ? escapeHref(taskUrl) : '';
  const safeCalendarUrl = escapeHref(googleCalendarUrl);

  const openTaskButton = taskUrl
    ? `<a href="${safeTaskUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;margin:0 8px 8px 0;">
          Open task
        </a>`
    : '';

  const calendarButton = `<a href="${safeCalendarUrl}" style="display:inline-block;background:#fff;color:#111;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;border:1px solid #111;margin:0 0 8px 0;">
        Add to Google Calendar
      </a>`;

  const buttons = `<p style="margin:24px 0 0;">${openTaskButton}${calendarButton}</p>`;
  const taskUrlLine = taskUrl
    ? `<p style="margin:16px 0 0;font-size:12px;color:#888;word-break:break-all;">${safeTaskUrl}</p>`
    : '';

  return `<!DOCTYPE html>
<html>
  <body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;margin:0;padding:24px;background:#f6f6f6;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:24px;">
      <p style="margin:0 0 8px;font-size:14px;color:#666;">Headlight Rabbits taskboard</p>
      <h1 style="margin:0 0 16px;font-size:22px;">You were assigned to a task</h1>
      <p style="margin:0 0 16px;">Hi ${safeAssigneeName}, <strong>${safeAssignedBy}</strong> assigned you to:</p>
      <p style="margin:0 0 8px;font-size:18px;font-weight:600;">${safeTaskName}</p>
      <p style="margin:0 0 16px;color:#444;">Project: <strong>${safeProjectName}</strong></p>
      ${descriptionBlock}
      ${deadlineLine}
      ${buttons}
      ${taskUrlLine}
    </div>
  </body>
</html>`;
}

export async function sendAssignmentEmail({
  to,
  assigneeName,
  assignedBy,
  taskName,
  description,
  projectName,
  deadline,
  taskUrl,
}) {
  const resend = getResend();
  const from = process.env.EMAIL_FROM;

  if (!resend || !from) {
    throw new Error('Email is not configured');
  }

  const subject = `Assigned: ${taskName} (${projectName})`;
  const html = buildAssignmentHtml({
    assigneeName,
    assignedBy,
    taskName,
    description,
    projectName,
    deadline,
    taskUrl,
  });

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (error) throw error;
}
