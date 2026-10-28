async function readJson(res: Response) {
  return res.json().catch(() => ({}));
}

export async function fetchQuotationEditors(): Promise<{
  editors: string[];
  quotationEditReady: boolean;
}> {
  const res = await fetch('/api/auth/quotation-edit-access', { credentials: 'include' });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error((data.error as string) || 'Could not load quotation editors.');
  }
  return {
    editors: Array.isArray(data.editors) ? data.editors.map(String) : [],
    quotationEditReady: data.quotationEditReady !== false,
  };
}

export async function setQuotationEditorAccess(username: string, enabled: boolean): Promise<void> {
  const res = await fetch('/api/auth/quotation-edit-access', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, enabled }),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error((data.error as string) || 'Could not update quotation edit access.');
  }
}
