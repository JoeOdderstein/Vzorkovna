/** Map task assignee label (e.g. "Gus") to login username (e.g. "gus"). */
export function assigneeToUsername(assignee) {
  return String(assignee ?? '').trim().toLowerCase();
}

export function normalizeAssignees(value) {
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === 'string' && entry.trim());
  }
  if (typeof value === 'string' && value.trim()) {
    return [value];
  }
  return [];
}
