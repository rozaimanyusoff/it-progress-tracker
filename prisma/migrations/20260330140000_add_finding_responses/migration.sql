-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "deliverable_id" INTEGER,
ADD COLUMN     "media_urls" TEXT[],
ADD COLUMN     "task_id" INTEGER;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
