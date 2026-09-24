import { assigneeToUsername } from './assigneeUsername.js';
import { defaultBoardNameForUsername } from './boardNameDefaults.js';

const PROFILE_COLUMNS = 'email, notify_on_assign, board_name, username';

function boardNameMatchesAssignee(profile, assignee) {
  const target = String(assignee ?? '').trim().toLowerCase();
  if (!target) return false;
  if (profile.board_name && profile.board_name.trim().toLowerCase() === target) {
    return true;
  }
  const fromUsername = defaultBoardNameForUsername(profile.username);
  return fromUsername != null && fromUsername.toLowerCase() === target;
}

/**
 * Resolve a taskboard assignee label (e.g. "Gus") to a user_profiles row.
 */
export async function findProfileForAssignee(supabase, assignee) {
  const label = String(assignee ?? '').trim();
  if (!label) {
    return { profile: null, reason: 'empty_assignee' };
  }

  const { data: byBoardName, error: boardError } = await supabase
    .from('user_profiles')
    .select(PROFILE_COLUMNS)
    .eq('board_name', label)
    .maybeSingle();

  if (boardError) {
    console.error(`Profile lookup failed for assignee ${label}:`, boardError);
    return { profile: null, reason: 'profile_lookup_failed' };
  }

  if (byBoardName) {
    return { profile: byBoardName, reason: null };
  }

  const loginUsername = assigneeToUsername(label);
  const { data: byUsername, error: userError } = await supabase
    .from('user_profiles')
    .select(PROFILE_COLUMNS)
    .eq('username', loginUsername)
    .maybeSingle();

  if (userError) {
    console.error(`Profile lookup failed for login ${loginUsername}:`, userError);
    return { profile: null, reason: 'profile_lookup_failed' };
  }

  if (byUsername && boardNameMatchesAssignee(byUsername, label)) {
    return { profile: byUsername, reason: null };
  }

  if (byUsername?.email) {
    return { profile: byUsername, reason: null };
  }

  const { data: allProfiles, error: listError } = await supabase
    .from('user_profiles')
    .select(PROFILE_COLUMNS);

  if (listError) {
    console.error('Profile list failed:', listError);
    return { profile: null, reason: 'profile_lookup_failed' };
  }

  const matched =
    (allProfiles ?? []).find((profile) => boardNameMatchesAssignee(profile, label)) ?? null;

  if (!matched) {
    return { profile: null, reason: 'no_profile_for_board_name' };
  }

  return { profile: matched, reason: null };
}
