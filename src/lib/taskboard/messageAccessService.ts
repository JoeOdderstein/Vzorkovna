export type MessageAccessMember = {
  username: string;
  board_name: string;
  granted_at: string | null;
  granted_by: string | null;
};

async function readJson(res: Response) {
  return res.json().catch(() => ({}));
}

export async function fetchMessageAccessMembers(): Promise<{
  members: MessageAccessMember[];
  messageAccessReady: boolean;
}> {
  const res = await fetch('/api/auth/message-access', { credentials: 'include' });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error((data.error as string) || 'Could not load message access.');
  }
  return {
    members: Array.isArray(data.members) ? data.members : [],
    messageAccessReady: data.messageAccessReady !== false,
  };
}

export async function grantMessageAccess(username: string): Promise<MessageAccessMember> {
  const res = await fetch('/api/auth/message-access', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error((data.error as string) || 'Could not grant message access.');
  }
  return data.member as MessageAccessMember;
}

export async function revokeMessageAccess(username: string): Promise<void> {
  const res = await fetch('/api/auth/message-access', {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error((data.error as string) || 'Could not revoke message access.');
  }
}
