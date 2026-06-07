-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dashboard_config" JSONB,
ADD COLUMN     "theme_preference" VARCHAR(10) DEFAULT 'dark';
