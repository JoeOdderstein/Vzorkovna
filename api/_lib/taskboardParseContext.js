import { isAdminUsername } from './auth.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';
import { collectTaskboardAssigneeNames } from './members.js';

function friendlyNetworkError(err, service) {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i.test(raw)) {
    return `Could not reach ${service}. Check your internet connection and Supabase/OpenAI settings. If this persists locally, restart the dev server (npm run dev).`;
  }
  return raw || `Could not reach ${service}.`;
}

function usernamesMatch(a, b) {
  return String(a ?? '')
    .trim()
    .toLowerCase() === String(b ?? '')
    .trim()
    .toLowerCase();
}

function normalizeVisibleTo(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const values = raw.map((v) => String(v).trim()).filter(Boolean);
    return values.length > 0 ? values : [];
  }
  return null;
}

function canUserSeeProject(project, username, isAdmin) {
  if (isAdmin || isAdminUsername(username)) return true;
  if (!username) return false;
  const allowed = normalizeVisibleTo(project.visible_to);
  if (allowed == null) return true;
  if (allowed.length === 0) return false;
  return allowed.some((name) => usernamesMatch(name, username));
}

export async function loadTaskboardProjectsForUser(username, isAdmin) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { projects: [], error: 'Supabase service role is not configured on the server.' };
  }

  let data;
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      ({ data, error } = await supabase
        .from('projects')
        .select('id, name, slug, sort_order, visible_to')
        .order('sort_order', { ascending: true }));
    } catch (err) {
      error = { message: err instanceof Error ? err.message : String(err) };
    }

    if (!error) break;
    const retryable = /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(error.message ?? '');
    if (!retryable || attempt === 2) break;
    await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
  }

  if (error) {
    const msg = error.message || 'Could not load projects.';
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(msg)) {
      return { projects: [], error: friendlyNetworkError(error, 'Supabase') };
    }
    return { projects: [], error: msg };
  }

  const rows = (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    visible_to: normalizeVisibleTo(row.visible_to),
  }));

  const projects = rows.filter((p) => canUserSeeProject(p, username, isAdmin));
  return { projects, error: null };
}

export async function loadTaskboardAssigneeNames() {
  try {
    const assignees = await collectTaskboardAssigneeNames();
    return { assignees, error: null };
  } catch (err) {
    return {
      assignees: [],
      error: err instanceof Error ? err.message : 'Could not load assignees.',
    };
  }
}
