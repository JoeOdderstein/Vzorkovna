-- Case-insensitive author checks for team message update/delete (matches auth_taskboard_username())
DROP POLICY IF EXISTS team_messages_update ON team_messages;
CREATE POLICY team_messages_update ON team_messages
  FOR UPDATE TO authenticated
  USING (lower(trim(author_username)) = auth_taskboard_username())
  WITH CHECK (lower(trim(author_username)) = auth_taskboard_username());

DROP POLICY IF EXISTS team_messages_delete ON team_messages;
CREATE POLICY team_messages_delete ON team_messages
  FOR DELETE TO authenticated
  USING (lower(trim(author_username)) = auth_taskboard_username());
