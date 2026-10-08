import { ensureSupabaseSession, getSupabase } from '../supabase';

/** Columns added in later migrations — omit and retry if the DB is not migrated yet. */
const OPTIONAL_INSTALLATION_COLUMNS = [
  'lifecycle_status_manual_override',
  'taskboard_project_id',
] as const;

function isMissingColumnError(message: string, column: string): boolean {
  const lower = message.toLowerCase();
  return (
    message.includes(column) ||
    lower.includes(`'${column}'`) ||
    (lower.includes('schema cache') && lower.includes(column))
  );
}

/** Persists installation row updates; strips optional columns if migrations are not applied yet. */
export async function patchInstallationRow(
  id: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await ensureSupabaseSession();
  const supabase = getSupabase();
  let attempt = { ...payload };

  for (let tries = 0; tries <= OPTIONAL_INSTALLATION_COLUMNS.length; tries += 1) {
    const { error } = await supabase.from('installations').update(attempt).eq('id', id);
    if (!error) return;

    const message = error.message ?? '';
    const missingOptional = OPTIONAL_INSTALLATION_COLUMNS.find(
      (column) => column in attempt && isMissingColumnError(message, column),
    );
    if (!missingOptional) {
      console.error('Installation update failed:', error);
      throw new Error('Could not save installation changes.');
    }

    const { [missingOptional]: _removed, ...rest } = attempt;
    attempt = rest;
  }
}
