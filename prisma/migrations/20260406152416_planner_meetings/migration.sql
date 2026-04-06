-- CreateTable
CREATE TABLE "Meeting" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "venue" TEXT,
    "date" DATE NOT NULL,
    "time_from" VARCHAR(5) NOT NULL,
    "time_to" VARCHAR(5) NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAttendee" (
    "meeting_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("meeting_id","user_id")
);

-- CreateTable
CREATE TABLE "MeetingAgenda" (
    "id" SERIAL NOT NULL,
    "meeting_id" INTEGER NOT NULL,
    "sort_no" INTEGER NOT NULL DEFAULT 0,
    "agenda" TEXT NOT NULL,
    "issued_by" TEXT,
    "time" VARCHAR(10),
    "details" TEXT,
    "action" TEXT,

    CONSTRAINT "MeetingAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAgendaPIC" (
    "agenda_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "MeetingAgendaPIC_pkey" PRIMARY KEY ("agenda_id","user_id")
);

-- CreateTable
CREATE TABLE "MeetingFollowup" (
    "id" SERIAL NOT NULL,
    "agenda_id" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingFollowup_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAgenda" ADD CONSTRAINT "MeetingAgenda_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAgendaPIC" ADD CONSTRAINT "MeetingAgendaPIC_agenda_id_fkey" FOREIGN KEY ("agenda_id") REFERENCES "MeetingAgenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAgendaPIC" ADD CONSTRAINT "MeetingAgendaPIC_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingFollowup" ADD CONSTRAINT "MeetingFollowup_agenda_id_fkey" FOREIGN KEY ("agenda_id") REFERENCES "MeetingAgenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingFollowup" ADD CONSTRAINT "MeetingFollowup_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
