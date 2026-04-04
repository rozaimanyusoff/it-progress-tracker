-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "company_id" INTEGER,
ADD COLUMN     "dept_id" INTEGER,
ADD COLUMN     "unit_id" INTEGER;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
