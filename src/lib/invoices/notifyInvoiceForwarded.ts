export async function notifyInvoiceForwarded(invoiceId: string): Promise<void> {
  const res = await fetch('/api/invoices/notify-forwarded', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoiceId }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Could not send notification.');
  }
}
