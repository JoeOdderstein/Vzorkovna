import { isAdminUsername } from './auth.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';

function quotationEditTableMissing(error) {
  const message = error?.message ?? '';
  return /quotation_edit_members|relation|does not exist/i.test(message);
}

export async function userCanEditQuotations(username, isAdmin = false) {
  if (isAdmin || isAdminUsername(username)) return true;
  if (!username) return false;

  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('quotation_edit_members')
    .select('username')
    .eq('username', String(username).trim().toLowerCase())
    .maybeSingle();

  if (error) {
    if (quotationEditTableMissing(error)) return false;
    console.error('Quotation edit access lookup failed:', error);
    return false;
  }

  return Boolean(data);
}

export async function fetchQuotationEditorUsernames() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { usernames: [], ready: false };

  const { data, error } = await supabase
    .from('quotation_edit_members')
    .select('username')
    .order('username', { ascending: true });

  if (error) {
    if (quotationEditTableMissing(error)) return { usernames: [], ready: false };
    throw error;
  }

  return {
    usernames: (data ?? []).map((row) => String(row.username)),
    ready: true,
  };
}

export async function setQuotationEditAccess(username, enabled, grantedBy) {
  const login = String(username ?? '')
    .trim()
    .toLowerCase();
  if (!login) throw new Error('Username is required.');

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Database not configured.');

  if (enabled) {
    const { error } = await supabase
      .from('quotation_edit_members')
      .upsert({ username: login, granted_by: grantedBy ?? null }, { onConflict: 'username' });
    if (error) {
      if (quotationEditTableMissing(error)) {
        throw new Error('Run migration 044_quotation_edit_access.sql in Supabase.');
      }
      throw error;
    }
    return;
  }

  const { error } = await supabase.from('quotation_edit_members').delete().eq('username', login);
  if (error) {
    if (quotationEditTableMissing(error)) {
      throw new Error('Run migration 044_quotation_edit_access.sql in Supabase.');
    }
    throw error;
  }
}

export async function revokeQuotationEditForUser(username) {
  try {
    await setQuotationEditAccess(username, false);
  } catch (err) {
    if (quotationEditTableMissing(err)) return;
    console.warn('Revoke quotation edit failed:', err);
  }
}
