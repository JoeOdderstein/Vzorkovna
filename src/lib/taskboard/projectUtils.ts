export function slugifyProjectName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'project';
}

export function ensureUniqueSlug(base: string, existing: string[]) {
  if (!existing.includes(base)) return base;

  let counter = 2;
  while (existing.includes(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}
