import { ensureSupabaseSession, getSupabase } from '../supabase';
import { isSupabaseConfigured } from '../taskboard/config';
import { patchInstallationRow } from './installationDbPatch';
import {
  getLocalInstallationPatch,
  mergeLocalInstallationPatch,
  notifyInstallationsUpdated,
} from './localInstallationOverrides';

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

async function countOpenBugReports(installationId: string): Promise<number> {
  const supabase = await db();
  const { count, error } = await supabase
    .from('installation_repairs')
    .select('id', { count: 'exact', head: true })
    .eq('installation_id', installationId)
    .eq('kind', 'bug_report')
    .eq('resolved', false);

  if (error) return 0;
  return count ?? 0;
}

/** Keeps lifecycle in sync with unresolved bug reports (respects manual lifecycle edits). */
export async function syncInstallationLifecycleFromOpenBugs(
  installationId: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await db();
  const openCount = await countOpenBugReports(installationId);

  let lifecycleStatus: string | undefined;
  let manualFromDb = false;

  const { data: instFull, error: instFullError } = await supabase
    .from('installations')
    .select('lifecycle_status, lifecycle_status_manual_override')
    .eq('id', installationId)
    .maybeSingle();

  if (instFullError) {
    const msg = instFullError.message ?? '';
    if (msg.includes('lifecycle_status_manual_override')) {
      const { data: instBasic, error: instBasicError } = await supabase
        .from('installations')
        .select('lifecycle_status')
        .eq('id', installationId)
        .maybeSingle();
      if (instBasicError || !instBasic) return;
      lifecycleStatus = String(instBasic.lifecycle_status);
    } else {
      return;
    }
  } else if (!instFull) {
    return;
  } else {
    lifecycleStatus = String(instFull.lifecycle_status);
    manualFromDb = Boolean(instFull.lifecycle_status_manual_override);
  }

  const localPatch = getLocalInstallationPatch(installationId);
  const manual =
    manualFromDb || Boolean(localPatch?.lifecycle_status_manual_override);

  if (openCount > 0) {
    if (manual || lifecycleStatus === 'maintenance_needed') return;

    try {
      await patchInstallationRow(installationId, {
        lifecycle_status: 'maintenance_needed',
        lifecycle_status_manual_override: false,
      });
      mergeLocalInstallationPatch(installationId, {
        lifecycle_status: 'maintenance_needed',
        lifecycle_status_manual_override: false,
      });
      notifyInstallationsUpdated();
    } catch {
      // ignore sync failures
    }
    return;
  }

  if (lifecycleStatus === 'operational' && !manual) return;

  try {
    await patchInstallationRow(installationId, {
      lifecycle_status: 'operational',
      lifecycle_status_manual_override: false,
    });
    mergeLocalInstallationPatch(installationId, {
      lifecycle_status: 'operational',
      lifecycle_status_manual_override: false,
    });
    notifyInstallationsUpdated();
  } catch {
    // ignore sync failures
  }
}
