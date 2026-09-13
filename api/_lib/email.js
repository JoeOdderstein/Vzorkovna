import { Resend } from 'resend';

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function formatDeadline(deadline) {
  if (!deadline) return null;
  const date = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(date.getTime())) return deadline;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function buildAssignmentHtml({
  assigneeName,
  assignedBy,
  taskName,
  projectName,
  deadline,
  taskUrl,
}) {
  const deadlineLine = deadline
    ? `<p style="margin:0 0 16px;color:#444;">Deadline: <strong>${formatDeadline(deadline)}</strong></p>`
    : '';

  const button = taskUrl
    ? `<p style="margin:24px 0 0;">
        <a href="${taskUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">
          Open task
        </a>
      </p>
      <p style="margin:16px 0 0;font-size:12px;color:#888;word-break:break-all;">${taskUrl}</p>`
    : '';

  return `<!DOCTYPE html>
<html>
  <body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;margin:0;padding:24px;background:#f6f6f6;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:24px;">
      <p style="margin:0 0 8px;font-size:14px;color:#666;">Headlight Rabbits taskboard</p>
      <h1 style="margin:0 0 16px;font-size:22px;">You were assigned to a task</h1>
      <p style="margin:0 0 16px;">Hi ${assigneeName}, <strong>${assignedBy}</strong> assigned you to:</p>
      <p style="margin:0 0 8px;font-size:18px;font-weight:600;">${taskName}</p>
      <p style="margin:0 0 16px;color:#444;">Project: <strong>${projectName}</strong></p>
      ${deadlineLine}
      ${button}
    </div>
  </body>
</html>`;
}

export async function sendAssignmentEmail({
  to,
  assigneeName,
  assignedBy,
  taskName,
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
