-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('on_track', 'at_risk', 'delayed', 'overdue');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'Blocked';

-- AlterTable
ALTER TABLE "Deliverable" ADD COLUMN     "is_actual_override" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "actual_end" TIMESTAMP(3),
ADD COLUMN     "actual_start" TIMESTAMP(3),
ADD COLUMN     "health_status" "HealthStatus";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "blocked_reason" VARCHAR(500),
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "est_mandays" DECIMAL(4,1),
ADD COLUMN     "is_blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
ADD COLUMN     "started_at" TIMESTAMP(3),
ADD COLUMN     "status_updated_at" TIMESTAMP(3),
ADD COLUMN     "status_updated_by" INTEGER,
ADD COLUMN     "submitted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TaskHistory" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "changed_by" INTEGER NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actual_date" TIMESTAMP(3),
    "note" TEXT,
    "is_auto_log" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_status_updated_by_fkey" FOREIGN KEY ("status_updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskHistory" ADD CONSTRAINT "TaskHistory_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskHistory" ADD CONSTRAINT "TaskHistory_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
