-- Per-account taskboard profiles (theme, email, notification prefs)
CREATE TABLE IF NOT EXISTS user_profiles (
  username TEXT PRIMARY KEY,
  email TEXT,
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  notify_on_assign BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_profiles_select_own ON user_profiles
  FOR SELECT TO authenticated
  USING (username = COALESCE(auth.jwt() ->> 'username', ''));

CREATE POLICY user_profiles_insert_own ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (username = COALESCE(auth.jwt() ->> 'username', ''));

CREATE POLICY user_profiles_update_own ON user_profiles
  FOR UPDATE TO authenticated
  USING (username = COALESCE(auth.jwt() ->> 'username', ''))
  WITH CHECK (username = COALESCE(auth.jwt() ->> 'username', ''));
