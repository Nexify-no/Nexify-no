-- PR #80 — "Legg til merkevare" becomes a short journey: URL → analysis →
-- review → confirm.
--
-- The brand row has to exist BEFORE the analysis runs, so that the brand, its
-- Merkehjerne and its website link all carry the same `brand_id` from the very
-- first write — no scratch table, no re-parenting afterwards. But a brand under
-- review is not a brand yet: it must not appear in the switcher, must not be
-- selectable, and must not be usable as the source for generated content.
--
-- Hence a third status. `draft` brands are invisible to listBrands (which
-- filters on 'active'), so every existing query keeps its behaviour and the
-- journey can be abandoned without leaving a half-brand behind.
--
-- Default stays 'active': brands created by the old create() path and by
-- ensureDefaultBrand are ready to use immediately.
ALTER TABLE `brands`
  MODIFY COLUMN `brand_status` enum('draft','active','archived') NOT NULL DEFAULT 'active';
