-- CreateTable
-- ADR-0013: one row per failed attempt to apply a treasury message, so the reason a message was
-- set aside can be read after the fact. Deliberately no foreign key to `treasury_messages`: the
-- attempt can fail before the message has a record, and a set-aside message gets one only after.
CREATE TABLE "treasury_message_failures" (
    "id" BIGSERIAL NOT NULL,
    "message_id" VARCHAR(128) NOT NULL,
    "attempt" INTEGER NOT NULL,
    "error" TEXT NOT NULL,
    "failed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "treasury_message_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "treasury_message_failures_message_id_idx" ON "treasury_message_failures"("message_id");
