-- AlterTable
-- ADR-0012, 1A: `held` is derived from what the invoice has left (ADR-0009), so a snapshot's
-- correction would be undone by the next release unless it is kept on the row. Signed, so no
-- CHECK on its sign; existing rows have never been corrected, hence the default.
ALTER TABLE "reservations" ADD COLUMN "held_correction" BIGINT NOT NULL DEFAULT 0;
