-- Add time tracking fields to Task
ALTER TABLE "Task" ADD COLUMN "time_started_at" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "time_spent_seconds" INTEGER NOT NULL DEFAULT 0;
