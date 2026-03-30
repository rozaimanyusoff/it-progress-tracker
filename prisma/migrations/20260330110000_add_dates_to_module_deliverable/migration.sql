-- Add start_date and end_date to Module
ALTER TABLE "Module" ADD COLUMN "start_date" TIMESTAMP(3);
ALTER TABLE "Module" ADD COLUMN "end_date" TIMESTAMP(3);

-- Add planned_start and planned_end to Deliverable
ALTER TABLE "Deliverable" ADD COLUMN "planned_start" TIMESTAMP(3);
ALTER TABLE "Deliverable" ADD COLUMN "planned_end" TIMESTAMP(3);
