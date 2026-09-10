-- Give every project its own copy of the starter categories (admin can remove per project)
INSERT INTO project_categories (project_id, slug, label, sort_order)
SELECT p.id, d.slug, d.label, d.sort_order
FROM projects p
CROSS JOIN (
  VALUES
    ('quotations', 'Quotations & Proposals', 1),
    ('designing', 'Designing', 2),
    ('installation', 'Installation & Implementation', 3),
    ('repairs', 'Repairs & Final Tweaks', 4)
) AS d(slug, label, sort_order)
ON CONFLICT (project_id, slug) DO NOTHING;
