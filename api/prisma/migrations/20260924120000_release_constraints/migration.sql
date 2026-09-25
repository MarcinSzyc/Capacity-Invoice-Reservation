-- AlterTable
-- The domain never releases more than the invoice has left, and `Money` refuses a negative, so
-- no writer of ours can break this. The constraint is what protects the table from any other.
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_released_within_invoice"
  CHECK ("released_invoice_amount" >= 0 AND "released_invoice_amount" <= "invoice_amount");

-- AlterTable
-- A-08: `kind` and `source` are Postgres enums; `reason` was a free VARCHAR(16), so the mapper
-- had to cast whatever it found. Constrained here instead, which is what lets it refuse.
-- A migration of its own rather than an edit to `releases`, which has already been applied:
-- changing an applied migration changes its checksum and `prisma migrate deploy` then refuses
-- the whole database. The gate cannot see that, because every test database starts empty.
ALTER TABLE "capacity_movements" ADD CONSTRAINT "capacity_movements_reason_known"
  CHECK ("reason" IS NULL OR "reason" IN ('repaid', 'cancelled'));
