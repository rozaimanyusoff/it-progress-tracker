-- CreateTable
CREATE TABLE "Deliverable" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "module_id" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "FeatureStatus" NOT NULL DEFAULT 'Pending',
    "mandays" INTEGER NOT NULL DEFAULT 0,
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: make feature_id nullable and add deliverable_id
ALTER TABLE "Task" ALTER COLUMN "feature_id" DROP NOT NULL;

ALTER TABLE "Task" ADD COLUMN "deliverable_id" INTEGER;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
