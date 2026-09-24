-- AlterTable
-- Carried from S-04: nothing in the service can write a rate that is not positive, because the
-- mapper is the only writer and `Rate.parse` refuses one. The constraint is what protects the
-- table from any other writer: such a row would throw out of the mapper on every later read.
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_rate_positive" CHECK ("rate" > 0);

-- AlterTable
-- Nothing has been released yet, so zero is the true backfill for the S-03 and S-04 rows. The
-- default is dropped at once so a mapper that forgets the column fails the insert instead of
-- silently booking a reservation as untouched.
ALTER TABLE "reservations" ADD COLUMN "released_invoice_amount" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "reservations" ALTER COLUMN "released_invoice_amount" DROP DEFAULT;
-- The domain never releases more than the invoice has left, and `Money` refuses a negative, so
-- no writer of ours can break this. The constraint is what protects the table from any other.
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_released_within_invoice"
  CHECK ("released_invoice_amount" >= 0 AND "released_invoice_amount" <= "invoice_amount");

-- CreateIndex
-- ADR-0009 Option A: a release id identifies one repayment of one invoice, so the same id on
-- another invoice is a different release. Partial, because only release rows carry the column.
CREATE UNIQUE INDEX "capacity_movements_reservation_id_release_id_key"
  ON "capacity_movements" ("reservation_id", "release_id")
  WHERE "release_id" IS NOT NULL;

-- AlterTable
-- A-08: `kind` and `source` are Postgres enums; `reason` was a free VARCHAR(16), so the mapper
-- had to cast whatever it found. Constrained here instead, which is what lets it refuse.
ALTER TABLE "capacity_movements" ADD CONSTRAINT "capacity_movements_reason_known"
  CHECK ("reason" IS NULL OR "reason" IN ('repaid', 'cancelled'));
