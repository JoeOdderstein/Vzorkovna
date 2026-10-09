import type { TaskCategory } from '../taskboard/constants';
import type { Project } from '../taskboard/types';

export type SuggestMessageProjectResult = {
  projectId: string | null;
  projectName: string | null;
  category: TaskCategory | null;
  source: 'local' | 'ai' | 'none';
};

const suggestCache = new Map<string, SuggestMessageProjectResult>();
const SUGGEST_CACHE_MAX = 64;

function rememberSuggest(title: string, result: SuggestMessageProjectResult) {
  if (result.source === 'none') return;
  if (suggestCache.size >= SUGGEST_CACHE_MAX) {
    const oldest = suggestCache.keys().next().value;
    if (oldest) suggestCache.delete(oldest);
  }
  suggestCache.set(title, result);
}

/** True when the title likely needs an OpenAI call (no local project match). */
export function titleNeedsAiProjectSuggest(title: string, projects: Project[]): boolean {
  return !matchProjectFromTitle(title.trim(), projects);
}

/** Client-side match when the title clearly mentions a project name. */
export function matchProjectFromTitle(title: string, projects: Project[]): string | null {
  const normalized = title.trim().toLowerCase();
  if (!normalized || projects.length === 0) return null;

  let best: { id: string; score: number } | null = null;

  for (const project of projects) {
    const name = project.name.trim().toLowerCase();
    if (!name) continue;

    if (normalized === name) {
      return project.id;
    }

    if (normalized.includes(name) || name.includes(normalized)) {
      const score = name.length;
      if (!best || score > best.score) best = { id: project.id, score };
      continue;
    }

    const slug = project.slug?.trim().toLowerCase();
    if (slug && slug.length >= 3 && normalized.includes(slug.replace(/-/g, ' '))) {
      const score = slug.length;
      if (!best || score > best.score) best = { id: project.id, score };
    }
  }

  return best?.id ?? null;
}

const CATEGORY_KEYWORDS: Record<TaskCategory, string[]> = {
  quotations: ['quote', 'quotation', 'proposal', 'bid', 'offer', 'rfq', 'estimate'],
  designing: ['design', 'mockup', 'layout', 'concept', 'visual', 'draft', 'render'],
  installation: ['install', 'installation', 'implement', 'deploy', 'setup', 'mount', 'onsite'],
  repairs: ['repair', 'fix', 'tweak', 'bug', 'issue', 'maintenance', 'broken', 'adjust'],
};

/** Heuristic category from title wording (global category ids). */
export function matchCategoryFromTitle(title: string): TaskCategory | null {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return null;

  for (const [id, words] of Object.entries(CATEGORY_KEYWORDS) as [TaskCategory, string[]][]) {
    if (words.some((word) => normalized.includes(word))) {
      return id;
    }
  }
  return null;
}

export async function suggestMessageProjectFromTitle(
  title: string,
  projects: Project[]
): Promise<SuggestMessageProjectResult> {
  const trimmed = title.trim();
  if (!trimmed) {
    return { projectId: null, projectName: null, category: null, source: 'none' };
  }

  const localCategory = matchCategoryFromTitle(trimmed);
  const localId = matchProjectFromTitle(trimmed, projects);

  if (localId) {
    const project = projects.find((p) => p.id === localId);
    const result: SuggestMessageProjectResult = {
      projectId: localId,
      projectName: project?.name ?? null,
      category: localCategory,
      source: 'local',
    };
    rememberSuggest(trimmed, result);
    return result;
  }

  const cached = suggestCache.get(trimmed);
  if (cached) return cached;

  let res: Response;
  try {
    res = await fetch('/api/messages/suggest-project', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: trimmed,
        projects: projects.map((p) => ({ id: p.id, name: p.name, slug: p.slug })),
      }),
    });
  } catch {
    if (localId || localCategory) {
      const project = localId ? projects.find((p) => p.id === localId) : undefined;
      return {
        projectId: localId,
        projectName: project?.name ?? null,
        category: localCategory,
        source: 'local',
      };
    }
    return { projectId: null, projectName: null, category: null, source: 'none' };
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (localId || localCategory) {
      const project = localId ? projects.find((p) => p.id === localId) : undefined;
      return {
        projectId: localId,
        projectName: project?.name ?? null,
        category: localCategory,
        source: 'local',
      };
    }
    return { projectId: null, projectName: null, category: null, source: 'none' };
  }

  const aiProjectId = data.projectId ? String(data.projectId) : null;
  const projectId = aiProjectId ?? localId;
  const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
  const categoryRaw = data.category ? String(data.category) : '';
  const categoryFromAi = categoryRaw ? (categoryRaw as TaskCategory) : null;
  const category = categoryFromAi ?? localCategory;
  const usedAi = Boolean(aiProjectId || categoryFromAi);

  const result: SuggestMessageProjectResult = {
    projectId: projectId ?? null,
    projectName:
      project?.name ?? (data.projectName ? String(data.projectName) : null),
    category,
    source: usedAi ? 'ai' : projectId || category ? 'local' : 'none',
  };
  rememberSuggest(trimmed, result);
  return result;
}
