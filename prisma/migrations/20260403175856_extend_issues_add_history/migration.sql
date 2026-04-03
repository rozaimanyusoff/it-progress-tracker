-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('minor', 'moderate', 'major', 'critical');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('bug', 'enhancement', 'clarification');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "issue_severity" "IssueSeverity" NOT NULL DEFAULT 'moderate',
ADD COLUMN     "issue_status" "IssueStatus" NOT NULL DEFAULT 'open',
ADD COLUMN     "issue_type" "IssueType" NOT NULL DEFAULT 'bug',
ADD COLUMN     "resolution_note" TEXT,
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "resolved_by_id" INTEGER;

-- CreateTable
CREATE TABLE "IssueHistory" (
    "id" SERIAL NOT NULL,
    "issue_id" INTEGER NOT NULL,
    "changed_by" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "from_value" TEXT,
    "to_value" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueHistory" ADD CONSTRAINT "IssueHistory_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueHistory" ADD CONSTRAINT "IssueHistory_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
