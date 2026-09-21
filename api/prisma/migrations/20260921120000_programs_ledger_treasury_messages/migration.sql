
-- CreateEnum
CREATE TYPE "capacity_movement_kind" AS ENUM ('limit_set', 'reserve', 'release', 'adjustment');

-- CreateEnum
CREATE TYPE "treasury_message_outcome" AS ENUM ('applied', 'stale', 'rejected');

-- CreateTable
CREATE TABLE "programs" (
    "program_id" VARCHAR(64) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "credit_limit" BIGINT NOT NULL,
    "reserved" BIGINT NOT NULL,
    "limit_event_time" TIMESTAMPTZ(6),
    "as_of" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("program_id")
);

-- CreateTable
CREATE TABLE "capacity_movements" (
    "id" BIGSERIAL NOT NULL,
    "program_id" VARCHAR(64) NOT NULL,
    "reservation_id" VARCHAR(128),
    "kind" "capacity_movement_kind" NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "delta_held" BIGINT NOT NULL,
    "limit_after" BIGINT NOT NULL,
    "reserved_after" BIGINT NOT NULL,
    "available_after" BIGINT NOT NULL,
    "client_id" VARCHAR(128),
    "message_id" VARCHAR(128),
    "release_id" VARCHAR(128),
    "reason" VARCHAR(16),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "capacity_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_messages" (
    "message_id" VARCHAR(128) NOT NULL,
    "program_id" VARCHAR(64),
    "type" VARCHAR(32),
    "payload" JSONB NOT NULL,
    "outcome" "treasury_message_outcome" NOT NULL,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treasury_messages_pkey" PRIMARY KEY ("message_id")
);

-- CreateIndex
CREATE INDEX "capacity_movements_program_id_id_idx" ON "capacity_movements"("program_id", "id");

-- AddForeignKey
ALTER TABLE "capacity_movements" ADD CONSTRAINT "capacity_movements_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("program_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- INV-09: every movement is attributable to a client or to a treasury message, never neither.
ALTER TABLE "capacity_movements" ADD CONSTRAINT "capacity_movements_attributable" CHECK ("client_id" IS NOT NULL OR "message_id" IS NOT NULL);
