export type TaskboardMember = {
  username: string;
  email: string | null;
  board_name: string | null;
  hasPassword: boolean;
  invitePending: boolean;
  inviteExpiresAt: string | null;
  source: 'env' | 'member' | 'both' | 'profile' | 'roster';
  isAdmin: boolean;
};

async function readJson(res: Response) {
  return res.json().catch(() => ({}));
}

export async function fetchMembers(): Promise<{
  members: TaskboardMember[];
  membersReady: boolean;
}> {
  const res = await fetch('/api/auth/members', { credentials: 'include' });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error((data.error as string) || 'Could not load members.');
  }
  return {
    members: Array.isArray(data.members) ? data.members : [],
    membersReady: data.membersReady !== false,
  };
}

export async function deleteMember(username: string): Promise<void> {
  const res = await fetch('/api/auth/members', {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error((data.error as string) || 'Could not remove member.');
  }
}

export async function createMember(input: {
  username: string;
  board_name: string;
  email: string;
}): Promise<TaskboardMember> {
  const res = await fetch('/api/auth/members', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error((data.error as string) || 'Could not add member.');
  }
  return data.member as TaskboardMember;
}

export async function sendMemberInvite(username: string): Promise<{
  inviteUrl: string;
  emailed: boolean;
}> {
  const res = await fetch('/api/auth/members-invite', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error((data.error as string) || 'Could not send invite.');
  }
  return {
    inviteUrl: String(data.inviteUrl ?? ''),
    emailed: Boolean(data.emailed),
  };
}

export async function fetchInvite(token: string): Promise<{
  username: string;
  boardName: string;
  expired: boolean;
}> {
  const res = await fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`);
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error((data.error as string) || 'This invite link is not valid.');
  }
  return {
    username: String(data.username ?? ''),
    boardName: String(data.boardName ?? ''),
    expired: Boolean(data.expired),
  };
}

export async function acceptInvite(token: string, password: string, confirmPassword: string) {
  const res = await fetch('/api/auth/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password, confirmPassword }),
  });
  const data = await readJson(res);
  if (!res.ok) {
    throw new Error((data.error as string) || 'Could not set password.');
  }
  return { username: String(data.username ?? '') };
}

export async function fetchAssigneeNames(): Promise<string[]> {
  const res = await fetch('/api/auth/assignees', { credentials: 'include' });
  const data = await readJson(res);
  if (!res.ok || !Array.isArray(data.assignees)) return [];
  return data.assignees as string[];
}
