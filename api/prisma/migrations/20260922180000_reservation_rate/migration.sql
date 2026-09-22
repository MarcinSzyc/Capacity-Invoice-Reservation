-- AlterTable
-- The default backfills the reservations S-03 created, which could only be same-currency and so
-- are all at one, and is dropped at once: a mapper that forgets the rate must fail the insert
-- rather than silently book at one.
ALTER TABLE "reservations" ADD COLUMN "rate" DECIMAL(20,8) NOT NULL DEFAULT 1;
ALTER TABLE "reservations" ALTER COLUMN "rate" DROP DEFAULT;
