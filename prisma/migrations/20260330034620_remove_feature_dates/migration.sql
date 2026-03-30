/*
  Warnings:

  - You are about to drop the column `planned_end` on the `Feature` table. All the data in the column will be lost.
  - You are about to drop the column `planned_start` on the `Feature` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Feature" DROP COLUMN "planned_end",
DROP COLUMN "planned_start";
