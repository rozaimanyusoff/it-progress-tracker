-- Align data with revised structure: Project > Deliverable > Tasks
-- Detach legacy module linkage from all existing deliverables.
UPDATE "Deliverable"
SET "module_id" = NULL
WHERE "module_id" IS NOT NULL;
