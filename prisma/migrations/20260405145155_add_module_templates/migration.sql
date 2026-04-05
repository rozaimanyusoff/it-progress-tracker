-- CreateEnum
CREATE TYPE "DeliverableType" AS ENUM ('database', 'backend', 'frontend', 'testing', 'documentation');

-- CreateTable
CREATE TABLE "ModuleTemplate" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateDeliverable" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "DeliverableType" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TemplateDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateTask" (
    "id" SERIAL NOT NULL,
    "template_deliverable_id" INTEGER NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "est_mandays" DECIMAL(4,1),
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TemplateTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModuleTemplate_code_key" ON "ModuleTemplate"("code");

-- AddForeignKey
ALTER TABLE "TemplateDeliverable" ADD CONSTRAINT "TemplateDeliverable_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "ModuleTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateTask" ADD CONSTRAINT "TemplateTask_template_deliverable_id_fkey" FOREIGN KEY ("template_deliverable_id") REFERENCES "TemplateDeliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
