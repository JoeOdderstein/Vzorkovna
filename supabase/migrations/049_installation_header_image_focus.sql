-- Vertical focal point for header banner (object-position Y: 0 = top, 50 = center, 100 = bottom).
ALTER TABLE installations
  ADD COLUMN IF NOT EXISTS header_image_focus_y SMALLINT NOT NULL DEFAULT 50;

ALTER TABLE installations DROP CONSTRAINT IF EXISTS installations_header_image_focus_y_check;
ALTER TABLE installations
  ADD CONSTRAINT installations_header_image_focus_y_check
  CHECK (header_image_focus_y >= 0 AND header_image_focus_y <= 100);
