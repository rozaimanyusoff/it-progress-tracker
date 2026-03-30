/*
  Warnings:
  - Drop column `module_id` from Feature (migrated to ProjectFeature)
  - Drop column `project_id` from Feature (migrated to ProjectFeature)
*/

-- CreateTable first (before data migration)
CREATE TABLE "ProjectFeature" (
    "project_id" INTEGER NOT NULL,
    "feature_id" INTEGER NOT NULL,
    "module_id" INTEGER,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFeature_pkey" PRIMARY KEY ("project_id","feature_id")
);

-- Migrate existing feature→project links before dropping columns
INSERT INTO "ProjectFeature" ("project_id", "feature_id", "module_id")
SELECT "project_id", "id", "module_id" FROM "Feature" WHERE "project_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Feature" DROP CONSTRAINT "Feature_module_id_fkey";

-- DropForeignKey
ALTER TABLE "Feature" DROP CONSTRAINT "Feature_project_id_fkey";

-- AlterTable
ALTER TABLE "Feature" DROP COLUMN "module_id",
DROP COLUMN "project_id";

-- AddForeignKey
ALTER TABLE "ProjectFeature" ADD CONSTRAINT "ProjectFeature_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFeature" ADD CONSTRAINT "ProjectFeature_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFeature" ADD CONSTRAINT "ProjectFeature_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;
