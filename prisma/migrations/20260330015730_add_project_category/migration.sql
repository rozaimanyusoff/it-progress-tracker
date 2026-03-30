-- CreateEnum
CREATE TYPE "ProjectCategory" AS ENUM ('Claimable', 'NonClaimable');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "category" "ProjectCategory" NOT NULL DEFAULT 'NonClaimable';
