import { isAdminUsername } from './auth.js';
import { loadTaskboardProjectsForUser } from './taskboardParseContext.js';

const MAX_TITLE_LENGTH = 200;

const GLOBAL_CATEGORIES = [
  { id: 'quotations', label: 'Quotations & Proposals' },
  { id: 'designing', label: 'Designing' },
  { id: 'installation', label: 'Installation & Implementation' },
  { id: 'repairs', label: 'Repairs & Final Tweaks' },
];

function readRequestBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      return {};
    }
  }
  return req.body;
}

function normalizeProjects(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => ({
      id: String(row?.id ?? '').trim(),
      name: String(row?.name ?? '').trim(),
      slug: String(row?.slug ?? '').trim(),
    }))
    .filter((p) => p.id && p.name);
}

function normalizeCategories(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return GLOBAL_CATEGORIES;
  const list = raw
    .map((row) => ({
      id: String(row?.id ?? row?.slug ?? '').trim(),
      label: String(row?.label ?? row?.id ?? '').trim(),
    }))
    .filter((c) => c.id);
  return list.length > 0 ? list : GLOBAL_CATEGORIES;
}

function resolveProjectId(modelProjectId, modelProjectName, projects) {
  const byId = projects.find((p) => p.id === modelProjectId);
  if (byId) return byId.id;

  const name = String(modelProjectName ?? '').trim().toLowerCase();
  if (!name) return null;

  const exact = projects.find((p) => p.name.toLowerCase() === name);
  if (exact) return exact.id;

  const slugMatch = projects.find((p) => p.slug.toLowerCase() === name.replace(/\s+/g, '-'));
  if (slugMatch) return slugMatch.id;

  const partial = projects.find(
    (p) => p.name.toLowerCase().includes(name) || name.includes(p.name.toLowerCase())
  );
  return partial?.id ?? null;
}

function resolveCategory(modelCategory, categories) {
  const id = String(modelCategory ?? '').trim().toLowerCase();
  if (!id) return null;
  const match = categories.find(
    (c) => c.id.toLowerCase() === id || c.label.toLowerCase() === id
  );
  return match?.id ?? null;
}

function buildPrompt({ title, projects, categories }) {
  const projectLines = projects.map((p) => `- id: ${p.id} | name: ${p.name}`).join('\n');
  const categoryLines = categories.map((c) => `- ${c.id} (${c.label})`).join('\n');

  return `Pick the single taskboard project that best matches this team message title.
If unsure, pick the closest match by name or client context.
Also suggest a category id when the title implies one (install, design, quote, repair, etc.).

Rules:
- Return JSON only matching the schema.
- projectId must be an exact id from the project list, or empty string if none fit.
- category must be a category id from the list, or empty string if unclear.

Projects:
${projectLines || '(none)'}

Categories (use id):
${categoryLines}

Title:
"""
${title}
"""`;
}

async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { error: 'missing_api_key' };
  }

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'message_project',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                projectId: { type: 'string' },
                projectName: { type: 'string' },
                category: { type: 'string' },
              },
              required: ['projectId', 'projectName', 'category'],
            },
          },
        },
        messages: [
          {
            role: 'system',
            content:
              'You match creative-studio message titles to taskboard projects. Output valid JSON only.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
  } catch (err) {
    console.error('OpenAI network error (suggest project):', err);
    return { error: 'openai_network' };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('OpenAI suggest project failed:', response.status, detail.slice(0, 500));
    return { error: 'openai_failed' };
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) return { error: 'empty_response' };

  try {
    return { data: JSON.parse(content) };
  } catch {
    return { error: 'invalid_json' };
  }
}

export async function handleSuggestMessageProject(req, res, session = {}) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = readRequestBody(req);
  const title = String(body.title ?? '').trim().slice(0, MAX_TITLE_LENGTH);
  if (!title) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  const username = String(session.username ?? '').trim();
  const isAdmin = Boolean(session.isAdmin) || isAdminUsername(username);

  let projects = normalizeProjects(body.projects);

  if (projects.length === 0) {
    const loaded = await loadTaskboardProjectsForUser(username, isAdmin);
    if (loaded.error && projects.length === 0) {
      return res.status(503).json({ error: loaded.error });
    }
    projects = loaded.projects;
  }

  const categories = normalizeCategories(body.categories);

  if (projects.length === 0) {
    return res.status(400).json({
      error: 'No taskboard projects found.',
    });
  }

  const openai = await callOpenAI(buildPrompt({ title, projects, categories }));

  if (openai.error === 'missing_api_key') {
    return res.status(503).json({
      error: 'AI is not configured. Set OPENAI_API_KEY on the server.',
      source: 'none',
    });
  }
  if (openai.error === 'openai_network') {
    return res.status(502).json({
      error: 'Could not reach OpenAI from the server.',
      source: 'none',
    });
  }
  if (openai.error) {
    return res.status(502).json({ error: 'Could not suggest project.', source: 'none' });
  }

  const projectId = resolveProjectId(
    openai.data?.projectId,
    openai.data?.projectName,
    projects
  );
  const category = resolveCategory(openai.data?.category, categories);
  const project = projectId ? projects.find((p) => p.id === projectId) : null;

  return res.status(200).json({
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    category,
    source: 'ai',
  });
}
