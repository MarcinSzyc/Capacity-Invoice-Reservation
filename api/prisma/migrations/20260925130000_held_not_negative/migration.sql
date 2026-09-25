-- AlterTable
-- INV-02, amended 2026-09-25: a snapshot may set `held` above `reserved_amount` (ADR-0012), so the
-- upper bound of the S-03 constraint no longer holds for every row. The lower bound does. A
-- client can still never raise `held`: the domain only lowers it on a release. A migration of its
-- own, since changing an applied one changes its checksum and `migrate deploy` refuses it.
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_held_within_reserved";
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_held_not_negative" CHECK ("held" >= 0);
