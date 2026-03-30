CREATE TABLE "DeliverableRecord" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliverableRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliverableRecord_title_key" ON "DeliverableRecord"("title");
