import { isLocalTaskboardMode } from './taskService';
import { localStore } from './localStore';
import { ensureSupabaseSession, getSupabase } from '../supabase';
import type { CalendarEvent, CalendarEventInsert } from './types';

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

function mapCalendarEvent(row: Record<string, unknown>): CalendarEvent {
  return row as CalendarEvent;
}

export async function isCalendarEventsReady() {
  if (isLocalTaskboardMode()) return true;

  const { error } = await (await db()).from('calendar_events').select('id').limit(1);
  return !error;
}

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  if (isLocalTaskboardMode()) return localStore.getCalendarEvents();

  const { data, error } = await (await db())
    .from('calendar_events')
    .select('*')
    .order('start_date', { ascending: true });

  if (error) {
    if (/calendar_events|relation|column/i.test(error.message)) return [];
    throw error;
  }

  return (data ?? []).map((row) => mapCalendarEvent(row as Record<string, unknown>));
}

export async function createCalendarEvent(input: CalendarEventInsert): Promise<CalendarEvent> {
  const title = input.title.trim() || 'Prague visit';
  if (input.end_date < input.start_date) {
    throw new Error('End date must be on or after the start date.');
  }

  if (isLocalTaskboardMode()) {
    return localStore.createCalendarEvent({ ...input, title });
  }

  const { data, error } = await (await db())
    .from('calendar_events')
    .insert({
      title,
      start_date: input.start_date,
      end_date: input.end_date,
    })
    .select('*')
    .single();

  if (error) {
    if (/calendar_events|relation|column/i.test(error.message)) {
      throw new Error(
        'Calendar events are not set up yet. Run supabase/migrations/008_calendar_events.sql in Supabase SQL Editor.'
      );
    }
    throw error;
  }

  return mapCalendarEvent(data as Record<string, unknown>);
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  if (isLocalTaskboardMode()) {
    localStore.deleteCalendarEvent(id);
    return;
  }

  const { error } = await (await db()).from('calendar_events').delete().eq('id', id);
  if (error) throw error;
}
