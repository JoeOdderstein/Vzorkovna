-- Regenerate feed summaries (older rows may contain non-AI fallback text).
update public.team_messages
set feed_summary = null
where feed_summary is not null;
