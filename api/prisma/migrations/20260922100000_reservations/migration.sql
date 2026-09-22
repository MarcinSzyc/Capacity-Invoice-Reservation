-- CreateEnum
CREATE TYPE "reservation_source" AS ENUM ('client', 'reconciliation');

-- AlterTable
-- S-02 never wrote a reservation id, so the column changes type with nothing to convert.
ALTER TABLE "capacity_movements" ALTER COLUMN "reservation_id" TYPE UUID USING "reservation_id"::uuid;

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "program_id" VARCHAR(64) NOT NULL,
    "invoice_id" VARCHAR(128) NOT NULL,
    "invoice_amount" BIGINT NOT NULL,
    "invoice_currency" CHAR(3) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reserved_amount" BIGINT NOT NULL,
    "held" BIGINT NOT NULL,
    "source" "reservation_source" NOT NULL,
    "client_id" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reservations_program_id_invoice_id_key" ON "reservations"("program_id", "invoice_id");

-- CreateIndex
CREATE INDEX "capacity_movements_reservation_id_idx" ON "capacity_movements"("reservation_id");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("program_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_movements" ADD CONSTRAINT "capacity_movements_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- INV-02: held never leaves [0, reserved_amount]; the storage backstop S-05 leans on.
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_held_within_reserved" CHECK ("held" >= 0 AND "held" <= "reserved_amount");
