import { DEFAULT_CATEGORIES } from './categoryUtils';
import { isLocalTaskboardMode } from './taskService';
import { localStore } from './localStore';
import { ensureUniqueSlug, slugifyProjectName } from './projectUtils';
import { ensureSupabaseSession, getSupabase } from '../supabase';
import type { CategoryOption, ProjectCategory } from './types';

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

function slugifyCategoryLabel(label: string, existingSlugs: string[]) {
  const baseSlug = slugifyProjectName(label) || 'category';
  return ensureUniqueSlug(baseSlug, existingSlugs);
}

function mapProjectCategory(row: Record<string, unknown>): ProjectCategory {
  return row as ProjectCategory;
}

function mapToOptions(categories: ProjectCategory[]): CategoryOption[] {
  return categories.map((category) => ({
    id: category.slug,
    label: category.label,
  }));
}

export async function isProjectCategoriesReady() {
  if (isLocalTaskboardMode()) return true;

  const { error } = await (await db()).from('project_categories').select('id').limit(1);
  return !error;
}

export async function fetchProjectCategories(projectId: string): Promise<ProjectCategory[]> {
  if (isLocalTaskboardMode()) return localStore.getProjectCategories(projectId);

  const { data, error } = await (await db())
    .from('project_categories')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (error) {
    if (/project_categories|relation|column/i.test(error.message)) return [];
    throw error;
  }

  return (data ?? []).map((row) => mapProjectCategory(row as Record<string, unknown>));
}

export async function seedDefaultCategoriesForProject(
  projectId: string
): Promise<ProjectCategory[]> {
  if (isLocalTaskboardMode()) {
    return localStore.seedDefaultCategoriesForProject(projectId);
  }

  const supabase = await db();
  const rows = DEFAULT_CATEGORIES.map((category, index) => ({
    project_id: projectId,
    slug: category.id,
    label: category.label,
    sort_order: index + 1,
  }));

  const { error } = await supabase
    .from('project_categories')
    .upsert(rows, { onConflict: 'project_id,slug', ignoreDuplicates: true });

  if (error) {
    if (/project_categories|relation|column/i.test(error.message)) {
      throw new Error(
        'Could not set up project categories. Run supabase/migrations/006_project_categories.sql and 007_seed_project_categories.sql in Supabase SQL Editor.'
      );
    }
    throw error;
  }

  return fetchProjectCategories(projectId);
}

export async function fetchCategoriesForProject(projectId: string): Promise<CategoryOption[]> {
  let categories = await fetchProjectCategories(projectId);
  if (categories.length === 0) {
    categories = await seedDefaultCategoriesForProject(projectId);
  }
  return mapToOptions(categories);
}

export async function refreshCategoriesForProject(
  projectId: string,
  created?: ProjectCategory
): Promise<CategoryOption[]> {
  const options = await fetchCategoriesForProject(projectId);
  if (created && !options.some((option) => option.id === created.slug)) {
    return [...options, { id: created.slug, label: created.label }];
  }
  return options;
}

export async function createProjectCategory(
  projectId: string,
  label: string
): Promise<ProjectCategory> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error('Category name is required');

  if (isLocalTaskboardMode()) return localStore.createProjectCategory(projectId, trimmed);

  const supabase = await db();
  const { data: existing, error: fetchError } = await supabase
    .from('project_categories')
    .select('slug, sort_order')
    .eq('project_id', projectId);

  if (fetchError) {
    if (/project_categories|relation|column/i.test(fetchError.message)) {
      throw new Error(
        'Could not save project category. Run supabase/migrations/006_project_categories.sql in Supabase SQL Editor, then try again.'
      );
    }
    throw fetchError;
  }

  const slug = slugifyCategoryLabel(
    trimmed,
    (existing ?? []).map((row) => row.slug)
  );
  const sort_order =
    (existing ?? []).reduce((max, row) => Math.max(max, row.sort_order ?? 0), 0) + 1;

  const { data, error } = await supabase
    .from('project_categories')
    .insert({ project_id: projectId, slug, label: trimmed, sort_order })
    .select('*')
    .single();

  if (error) {
    if (/project_categories|relation|column/i.test(error.message)) {
      throw new Error(
        'Could not save project category. Run supabase/migrations/006_project_categories.sql in Supabase SQL Editor, then try again.'
      );
    }
    throw error;
  }

  return mapProjectCategory(data as Record<string, unknown>);
}

export async function deleteProjectCategory(
  projectId: string,
  categorySlug: string
): Promise<void> {
  const categories = await fetchProjectCategories(projectId);
  if (categories.length <= 1) {
    throw new Error('A project needs at least one category.');
  }

  if (isLocalTaskboardMode()) {
    localStore.deleteProjectCategory(projectId, categorySlug);
    return;
  }

  const supabase = await db();

  const { count, error: countError } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('category', categorySlug);

  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new Error('Move or complete all tasks in this category before removing it.');
  }

  const { error } = await supabase
    .from('project_categories')
    .delete()
    .eq('project_id', projectId)
    .eq('slug', categorySlug);

  if (error) {
    if (/project_categories|relation|column/i.test(error.message)) {
      throw new Error(
        'Could not remove project category. Run supabase/migrations/006_project_categories.sql in Supabase SQL Editor, then try again.'
      );
    }
    throw error;
  }
}

export { DEFAULT_CATEGORIES };
