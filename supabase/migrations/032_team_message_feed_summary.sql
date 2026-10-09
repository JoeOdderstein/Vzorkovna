alter table public.team_messages
  add column if not exists feed_summary text;

comment on column public.team_messages.feed_summary is
  'AI-generated chat feed recap (max ~50 words); full body shown when user expands the message.';
