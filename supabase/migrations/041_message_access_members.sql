-- Users (besides admin) who may see the Messages tab; managed by admin via Manage members.

CREATE TABLE IF NOT EXISTS message_access_members (
  username TEXT PRIMARY KEY,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by TEXT,
  CONSTRAINT message_access_username_format CHECK (username ~ '^[a-z0-9][a-z0-9_-]{1,31}$')
);

CREATE INDEX IF NOT EXISTS idx_message_access_granted_at
  ON message_access_members (granted_at DESC);

ALTER TABLE message_access_members ENABLE ROW LEVEL SECURITY;

-- No authenticated policies: access is checked via service role in /api/auth/message-access.

CREATE OR REPLACE FUNCTION public.has_message_area_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth_taskboard_username() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM message_access_members
      WHERE username = auth_taskboard_username()
    );
$$;

DROP POLICY IF EXISTS team_messages_select ON team_messages;
CREATE POLICY team_messages_select ON team_messages
  FOR SELECT TO authenticated
  USING (has_message_area_access());

DROP POLICY IF EXISTS team_messages_insert ON team_messages;
CREATE POLICY team_messages_insert ON team_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    has_message_area_access()
    AND author_username = COALESCE(auth.jwt() ->> 'username', '')
  );

DROP POLICY IF EXISTS team_messages_update ON team_messages;
CREATE POLICY team_messages_update ON team_messages
  FOR UPDATE TO authenticated
  USING (
    has_message_area_access()
    AND lower(trim(author_username)) = auth_taskboard_username()
  )
  WITH CHECK (
    has_message_area_access()
    AND lower(trim(author_username)) = auth_taskboard_username()
  );

DROP POLICY IF EXISTS team_messages_delete ON team_messages;
CREATE POLICY team_messages_delete ON team_messages
  FOR DELETE TO authenticated
  USING (
    has_message_area_access()
    AND lower(trim(author_username)) = auth_taskboard_username()
  );
