export type InvoiceAccessMember = {
  username: string;
  board_name: string;
  granted_at: string | null;
  granted_by: string | null;
};

async function readJson(res: Response) {
  return res.json().catch(() => ({}));
}

export async function fetchInvoiceAccessMembers(): Promise<{
  members: InvoiceAccessMember[];
  invoiceAccessReady: boolean;
}> {
  const res = await fetch('/api/auth/invoice-access', { credentials: 'include' });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error((data.error as string) || 'Could not load invoice access.');
  }
  return {
    members: Array.isArray(data.members) ? data.members : [],
    invoiceAccessReady: data.invoiceAccessReady !== false,
  };
}

export async function grantInvoiceAccess(username: string): Promise<InvoiceAccessMember> {
  const res = await fetch('/api/auth/invoice-access', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error((data.error as string) || 'Could not grant invoice access.');
  }
  return data.member as InvoiceAccessMember;
}

export async function revokeInvoiceAccess(username: string): Promise<void> {
  const res = await fetch('/api/auth/invoice-access', {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error((data.error as string) || 'Could not revoke invoice access.');
  }
}
