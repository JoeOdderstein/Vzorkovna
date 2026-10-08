export async function notifyInvoiceUpload(payload: {
  invoiceId: string;
  notifyUsernames: string[];
}) {
  const res = await fetch('/api/invoices/notify-upload', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Could not send notifications.');
  }
}
