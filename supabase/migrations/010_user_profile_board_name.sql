-- Link login accounts to taskboard assignee names (e.g. admin -> Joost)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS board_name TEXT;

UPDATE user_profiles
SET board_name = 'Joost'
WHERE username = 'admin' AND (board_name IS NULL OR board_name = '');

UPDATE user_profiles
SET board_name = 'Gus'
WHERE username = 'gus' AND (board_name IS NULL OR board_name = '');

UPDATE user_profiles
SET board_name = 'Pasha'
WHERE username IN ('pasha', 'vzorkovna') AND (board_name IS NULL OR board_name = '');

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_board_name_unique
  ON user_profiles (board_name)
  WHERE board_name IS NOT NULL;
