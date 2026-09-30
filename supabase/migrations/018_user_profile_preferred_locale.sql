-- Preferred reading language for taskboard text (translation is view-only; originals stay in DB).

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS preferred_locale TEXT NOT NULL DEFAULT 'en';

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_preferred_locale_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_preferred_locale_check
  CHECK (preferred_locale IN ('en', 'uk'));
