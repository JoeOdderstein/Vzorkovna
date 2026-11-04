/**
 * Restore timeline_entry_id on quotation lines from a Supabase backup (or JSON export).
 *
 * The live DB lost phase links when the timeline was saved with delete-all + re-insert
 * (FK ON DELETE SET NULL). This script copies links from a snapshot taken BEFORE that.
 *
 * Usage:
 *
 * 1) Supabase Dashboard → Database → Backups → Restore to new project
 *    Pick a time BEFORE phase links were cleared (e.g. 2026-11-04 16:45 UTC).
 *
 * 2) Export snapshot rows (SQL editor on the restored project):
 *    SELECT pq.title, pq.project_id, pql.label, pql.notes, pql.sort_order,
 *           pql.timeline_entry_id
 *    FROM project_quotation_lines pql
 *    JOIN project_quotations pq ON pq.id = pql.quotation_id
 *    WHERE pql.kind = 'line' AND pql.timeline_entry_id IS NOT NULL;
 *
 *    Save as JSON array → ./scripts/.recovery/quotation-phase-snapshot.json
 *
 * 3) Dry run (default):
 *    node --env-file=.env scripts/recover-quotation-phase-links.mjs
 *
 * 4) Apply updates to LIVE project:
 *    node --env-file=.env scripts/recover-quotation-phase-links.mjs --apply
 *
 * Or pull snapshot directly from a restored project:
 *    RESTORE_SUPABASE_URL=... RESTORE_SERVICE_ROLE_KEY=... \
 *      node --env-file=.env scripts/recover-quotation-phase-links.mjs --apply
 */

import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SNAPSHOT_PATH = new URL('./.recovery/quotation-phase-snapshot.json', import.meta.url);

function norm(s) {
  return String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function loadEnvFile() {
  try {
    const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const line of raw.split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i < 0) continue;
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    // ignore
  }
}

loadEnvFile();

const apply = process.argv.includes('--apply');

const liveUrl = process.env.VITE_SUPABASE_URL;
const liveKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!liveUrl || !liveKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const live = createClient(liveUrl, liveKey);

async function loadSnapshotRows() {
  const restoreUrl = process.env.RESTORE_SUPABASE_URL?.trim();
  const restoreKey = process.env.RESTORE_SERVICE_ROLE_KEY?.trim();
  if (restoreUrl && restoreKey) {
    const restore = createClient(restoreUrl, restoreKey);
    const { data, error } = await restore
      .from('project_quotation_lines')
      .select(
        'label, notes, sort_order, timeline_entry_id, kind, project_quotations!inner(title, project_id)',
      )
      .eq('kind', 'line')
      .not('timeline_entry_id', 'is', null);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      title: row.project_quotations.title,
      project_id: row.project_quotations.project_id,
      label: row.label,
      notes: row.notes,
      sort_order: row.sort_order,
      timeline_entry_id: row.timeline_entry_id,
    }));
  }

  if (!existsSync(SNAPSHOT_PATH)) {
    console.error(
      'No snapshot found. Either:\n' +
        `  - Put JSON at ${SNAPSHOT_PATH.pathname}\n` +
        '  - Or set RESTORE_SUPABASE_URL + RESTORE_SERVICE_ROLE_KEY',
    );
    process.exit(1);
  }

  const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('Snapshot JSON must be an array');
  return parsed;
}

async function main() {
  mkdirSync(new URL('./.recovery/', import.meta.url), { recursive: true });

  const snapshot = await loadSnapshotRows();
  console.log(`Snapshot rows with phase links: ${snapshot.length}`);
  if (snapshot.length === 0) {
    console.log('Nothing to restore.');
    return;
  }

  const { data: liveQuotations, error: qErr } = await live
    .from('project_quotations')
    .select('id, title, project_id, archived_at');
  if (qErr) throw qErr;

  const liveQuotationByKey = new Map();
  for (const q of liveQuotations ?? []) {
    if (q.archived_at) continue;
    liveQuotationByKey.set(`${q.project_id}::${norm(q.title)}`, q);
  }

  const { data: liveLines, error: lErr } = await live
    .from('project_quotation_lines')
    .select('id, quotation_id, label, notes, sort_order, timeline_entry_id, kind')
    .eq('kind', 'line');
  if (lErr) throw lErr;

  const linesByQuotation = new Map();
  for (const line of liveLines ?? []) {
    const list = linesByQuotation.get(line.quotation_id) ?? [];
    list.push(line);
    linesByQuotation.set(line.quotation_id, list);
  }

  const { data: timelineEntries, error: tErr } = await live
    .from('project_timeline_entries')
    .select('id, project_id, entry_kind');
  if (tErr) throw tErr;

  const validPhaseIds = new Set(
    (timelineEntries ?? [])
      .filter((e) => (e.entry_kind ?? 'phase') === 'phase')
      .map((e) => e.id),
  );

  const updates = [];
  const unmatched = [];

  for (const snap of snapshot) {
    const q = liveQuotationByKey.get(`${snap.project_id}::${norm(snap.title)}`);
    if (!q) {
      unmatched.push({ reason: 'quotation-not-found', snap });
      continue;
    }
    const candidates = linesByQuotation.get(q.id) ?? [];
    const labelKey = norm(snap.label);
    const noteKey = norm(snap.notes);

    let line =
      candidates.find(
        (c) =>
          c.sort_order === snap.sort_order &&
          norm(c.label) === labelKey &&
          norm(c.notes) === noteKey,
      ) ??
      candidates.find(
        (c) => norm(c.label) === labelKey && norm(c.notes) === noteKey,
      ) ??
      candidates.find((c) => c.sort_order === snap.sort_order && norm(c.label) === labelKey);

    if (!line) {
      unmatched.push({ reason: 'line-not-found', snap });
      continue;
    }

    if (!validPhaseIds.has(snap.timeline_entry_id)) {
      unmatched.push({ reason: 'phase-id-missing-on-live', snap, lineId: line.id });
      continue;
    }

    if (line.timeline_entry_id === snap.timeline_entry_id) continue;

    updates.push({
      lineId: line.id,
      quotationTitle: q.title,
      label: line.label,
      from: line.timeline_entry_id,
      to: snap.timeline_entry_id,
    });
  }

  console.log(`Matched updates: ${updates.length}`);
  console.log(`Unmatched snapshot rows: ${unmatched.length}`);

  for (const u of updates.slice(0, 30)) {
    console.log(`  • ${u.quotationTitle} | ${norm(u.label).slice(0, 50)} → phase ${u.to}`);
  }
  if (updates.length > 30) console.log(`  … and ${updates.length - 30} more`);

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to write to the live database.');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const u of updates) {
    const { error } = await live
      .from('project_quotation_lines')
      .update({ timeline_entry_id: u.to })
      .eq('id', u.lineId);
    if (error) {
      fail += 1;
      console.error('Update failed', u.lineId, error.message);
    } else {
      ok += 1;
    }
  }

  console.log(`\nApplied ${ok} updates, ${fail} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
