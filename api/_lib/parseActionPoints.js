import { isAdminUsername } from './auth.js';
import {
  loadTaskboardAssigneeNames,
  loadTaskboardProjectsForUser,
} from './taskboardParseContext.js';

const MAX_TEXT_LENGTH = 8000;
const MAX_TASKS = 12;

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

function normalizeAssigneeList(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((a) => String(a ?? '').trim()).filter(Boolean))];
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
  if (!id) return categories[0]?.id ?? 'quotations';
  const match = categories.find(
    (c) => c.id.toLowerCase() === id || c.label.toLowerCase() === id
  );
  return match?.id ?? categories[0]?.id ?? 'quotations';
}

function resolveAssignees(modelAssignees, allowedAssignees) {
  const allowedLower = new Map(allowedAssignees.map((a) => [a.toLowerCase(), a]));
  const raw = Array.isArray(modelAssignees) ? modelAssignees : [];
  const resolved = [];
  for (const item of raw) {
    const key = String(item ?? '').trim().toLowerCase();
    const hit = allowedLower.get(key);
    if (hit && !resolved.includes(hit)) resolved.push(hit);
  }
  return resolved;
}

function buildPrompt({ text, projects, assignees, categories }) {
  const projectLines = projects.map((p) => `- id: ${p.id} | name: ${p.name}`).join('\n');
  const assigneeLines = assignees.map((a) => `- ${a}`).join('\n');
  const categoryLines = categories.map((c) => `- ${c.id} (${c.label})`).join('\n');

  return `You extract actionable taskboard tasks from team messages.

Rules:
- Return JSON only, matching the schema.
- Create separate tasks when different people owe different work, or work belongs to different projects.
- Use exact project "id" from the list below.
- assignees must use exact names from the assignee list (board names).
- category must be one of the category ids listed.
- If the message has no clear actionable tasks, return an empty tasks array.
- taskName: short imperative title (max 120 chars).
- Do not invent people or projects not in the lists.

Projects:
${projectLines || '(none)'}

Assignees (board names):
${assigneeLines || '(none)'}

Categories (use id):
${categoryLines}

Message:
"""
${text}
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
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'action_points',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              tasks: {
                type: 'array',
                maxItems: MAX_TASKS,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    taskName: { type: 'string' },
                    projectId: { type: 'string' },
                    projectName: { type: 'string' },
                    category: { type: 'string' },
                    assignees: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                  required: ['taskName', 'projectId', 'projectName', 'category', 'assignees'],
                },
              },
            },
            required: ['tasks'],
          },
        },
      },
      messages: [
        {
          role: 'system',
          content:
            'You are a task extraction assistant for a creative studio taskboard. Output valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
    }),
    });
  } catch (err) {
    console.error('OpenAI network error:', err);
    return { error: 'openai_network' };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('OpenAI parse failed:', response.status, detail.slice(0, 500));
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

export async function handleParseActionPoints(req, res, session = {}) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = readRequestBody(req);
  const text = String(body.text ?? '').trim().slice(0, MAX_TEXT_LENGTH);
  if (!text) {
    return res.status(400).json({ error: 'Message text is required.' });
  }

  const username = String(session.username ?? '').trim();
  const isAdmin = Boolean(session.isAdmin) || isAdminUsername(username);

  let projects = normalizeProjects(body.projects);
  let assignees = normalizeAssigneeList(body.assignees);

  if (projects.length === 0) {
    const loaded = await loadTaskboardProjectsForUser(username, isAdmin);
    if (loaded.error && projects.length === 0) {
      return res.status(503).json({ error: loaded.error });
    }
    projects = loaded.projects;
  }

  if (assignees.length === 0) {
    const loaded = await loadTaskboardAssigneeNames();
    if (loaded.error && assignees.length === 0) {
      return res.status(503).json({ error: loaded.error });
    }
    assignees = loaded.assignees;
  }

  const categories = normalizeCategories(body.categories);

  if (projects.length === 0) {
    return res.status(400).json({
      error:
        'No taskboard projects found. Run supabase/migrations/001_taskboard.sql or check project visibility.',
    });
  }
  if (assignees.length === 0) {
    return res.status(400).json({ error: 'No taskboard assignees found.' });
  }

  const openai = await callOpenAI(
    buildPrompt({ text, projects, assignees, categories })
  );

  if (openai.error === 'missing_api_key') {
    return res.status(503).json({
      error: 'AI parsing is not configured. Set OPENAI_API_KEY on the server.',
    });
  }
  if (openai.error === 'openai_network') {
    return res.status(502).json({
      error:
        'Could not reach OpenAI from the server. Check your internet connection and OPENAI_API_KEY, then restart the dev server.',
    });
  }
  if (openai.error) {
    return res.status(502).json({ error: 'Could not parse message. Try again or add tasks manually.' });
  }

  const rawTasks = Array.isArray(openai.data?.tasks) ? openai.data.tasks : [];
  const tasks = [];

  for (const row of rawTasks.slice(0, MAX_TASKS)) {
    const taskName = String(row?.taskName ?? '').trim().slice(0, 200);
    if (!taskName) continue;

    const projectId = resolveProjectId(row?.projectId, row?.projectName, projects);
    if (!projectId) continue;

    const category = resolveCategory(row?.category, categories);
    const taskAssignees = resolveAssignees(row?.assignees, assignees);
    if (taskAssignees.length === 0) continue;

    tasks.push({
      taskName,
      projectId,
      category,
      assignees: taskAssignees,
    });
  }

  return res.status(200).json({
    tasks,
    projects: projects.map((p) => ({ id: p.id, name: p.name, slug: p.slug })),
    assignees,
  });
}
