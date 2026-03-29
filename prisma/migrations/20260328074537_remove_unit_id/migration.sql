/*
  Warnings:

  - You are about to drop the column `unit_id` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `unit_id` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Unit` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_unit_id_fkey";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "unit_id";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "unit_id";

-- DropTable
DROP TABLE "Unit";
