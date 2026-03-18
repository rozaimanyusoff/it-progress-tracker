/*
  Warnings:

  - A unique constraint covering the columns `[activation_token]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activation_token" TEXT,
ADD COLUMN     "activation_token_expiry" TIMESTAMP(3),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_activation_token_key" ON "User"("activation_token");
