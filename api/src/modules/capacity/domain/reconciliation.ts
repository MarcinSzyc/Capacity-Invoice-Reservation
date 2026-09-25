import {CapacityMovement} from './capacity-movement';
import {CurrencyMismatchError} from './errors';
import {Money} from './money';
import {Program} from './program';
import {Reservation} from './reservation';

/** One entry of a snapshot's list: an invoice the treasury holds capacity for, and how much. */
export interface ListedReservation {
  readonly invoiceId: string;
  /** In the snapshot's currency, which is `creditLimit.currency`. */
  readonly held: Money;
}

/** A treasury snapshot (A-11, A-12), already validated and typed. */
export interface ReconciliationSnapshot {
  readonly messageId: string;
  readonly asOf: Date;
  readonly creditLimit: Money;
  readonly activeReservations: readonly ListedReservation[];
}

/** A local reservation the snapshot concerns, with what happened to it after the snapshot's moment. */
export interface LocalReservation {
  readonly reservation: Reservation;
  /** ADR-0012, 2A: the signed `deltaHeld` of its client movements after `asOf`. */
  readonly deltaHeldAfterAsOf: bigint;
  /** ADR-0012, 3A: its closing movement was a client release after `asOf`. */
  readonly closedByClientAfterAsOf: boolean;
}

export interface ReconciliationInput {
  readonly program: Program;
  readonly snapshot: ReconciliationSnapshot;
  /** Every local reservation the snapshot lists, and every active one it does not. */
  readonly local: readonly LocalReservation[];
  /** ADR-0010: how long before `asOf` a reservation must be to be released by omission. */
  readonly keepWindowMs: number;
  /** When we apply it, stamped on the movements; `asOf` is on the program. */
  readonly appliedAt: Date;
}

/** What an operator should see in the logs: every case where the snapshot was not followed. */
export type ReconciliationNote =
  | {readonly kind: 'limit_skipped' | 'as_of_ahead_of_our_clock'}
  | {
      readonly kind:
        | 'kept_within_window'
        | 'listed_after_as_of'
        | 'kept_closed_after_as_of'
        | 'listed_with_nothing_held'
        | 'listed_in_other_currency';
      readonly invoiceId: string;
    };

export type ReconciliationResult =
  | {readonly kind: 'stale'; readonly appliedAsOf: Date}
  | {
      readonly kind: 'applied';
      /** The limit first, then one adjustment per invoice in invoice id order. */
      readonly movements: CapacityMovement[];
      readonly created: Reservation[];
      readonly changed: Reservation[];
      readonly notes: ReconciliationNote[];
    };

type Step =
  | {readonly kind: 'none'}
  | {readonly kind: 'note'; readonly note: ReconciliationNote}
  | {
      readonly kind: 'changed' | 'created';
      readonly reservation: Reservation;
      readonly deltaHeld: bigint;
    };

const NONE: Step = {kind: 'none'};

/**
 * A-12: a snapshot compared against its own moment, never a wholesale replace. The program and
 * the reservations are changed in place; the caller persists what the result names, in one
 * transaction behind the program row lock (ADR-0008). A pure function over values, so INV-06 and
 * INV-07 are decided here and only carried by the layers around it.
 */
export const reconcile = (input: ReconciliationInput): ReconciliationResult => {
  const {program, snapshot} = input;
  const appliedAsOf = program.asOf;
  if (appliedAsOf !== null && program.isStaleSnapshot(snapshot.asOf)) {
    return {kind: 'stale', appliedAsOf};
  }
  guardCurrency(input);

  const movements: CapacityMovement[] = [];
  const notes: ReconciliationNote[] = [];
  // S-06 local decision 10: applied, not refused, but every later snapshot is stale until then.
  if (snapshot.asOf.getTime() > input.appliedAt.getTime() + input.keepWindowMs) {
    notes.push({kind: 'as_of_ahead_of_our_clock'});
  }
  const limit = program.setLimit(snapshot.creditLimit, snapshot.asOf, snapshot.messageId);
  if (limit.kind === 'applied') movements.push(limit.movement);
  else notes.push({kind: 'limit_skipped'});

  const created: Reservation[] = [];
  const changed: Reservation[] = [];
  for (const step of steps(input)) {
    if (step.kind === 'note') notes.push(step.note);
    if (step.kind !== 'changed' && step.kind !== 'created') continue;
    (step.kind === 'created' ? created : changed).push(step.reservation);
    movements.push(
      program.adjust({
        deltaHeld: step.deltaHeld,
        reservationId: step.reservation.reservationId,
        messageId: snapshot.messageId,
        occurredAt: input.appliedAt,
      }),
    );
  }

  program.reconciledAt(snapshot.asOf);
  return {kind: 'applied', movements, created, changed, notes};
};

/**
 * ADR-0007 and A-12: another currency re-denominates only a program with no active reservation,
 * which would hold an amount in the old currency, and only when the limit part applies, since a
 * stale one would leave the stored limit in the old currency. Judged before anything changes. A
 * listed closed reservation does not stop it: it is skipped instead (`stepForListed`).
 */
const guardCurrency = ({program, snapshot, local}: ReconciliationInput): void => {
  const currency = snapshot.creditLimit.currency;
  if (currency === program.currency) return;
  const limitStale = program.limitEventTime !== null && snapshot.asOf < program.limitEventTime;
  const anyActive = local.some((entry) => entry.reservation.status === 'active');
  if (!anyActive && !limitStale) return;
  throw new CurrencyMismatchError(program.currency, currency, `Program ${program.programId}`);
};

/** One step per invoice either side names, in invoice id order, so the ledger is deterministic. */
const steps = (input: ReconciliationInput): Step[] => {
  const listed = new Map(input.snapshot.activeReservations.map((l) => [l.invoiceId, l.held]));
  const localBy = new Map(input.local.map((l) => [l.reservation.invoiceId, l]));
  const invoiceIds = [...new Set([...listed.keys(), ...localBy.keys()])].sort();
  return invoiceIds.map((invoiceId) => {
    const entry = localBy.get(invoiceId);
    const held = listed.get(invoiceId);
    if (entry !== undefined) return stepForLocal(entry, held, input);
    if (held !== undefined) return stepForUnknown(invoiceId, held, input);
    return NONE;
  });
};

const stepForUnknown = (invoiceId: string, held: Money, input: ReconciliationInput): Step => {
  if (held.isZero()) return {kind: 'note', note: {kind: 'listed_with_nothing_held', invoiceId}};
  const reservation = Reservation.fromSnapshot({
    programId: input.program.programId,
    invoiceId,
    held,
    asOf: input.snapshot.asOf,
  });
  return {kind: 'created', reservation, deltaHeld: held.amount};
};

const stepForLocal = (
  entry: LocalReservation,
  held: Money | undefined,
  input: ReconciliationInput,
): Step => {
  const {reservation} = entry;
  const invoiceId = reservation.invoiceId;
  // INV-06: a snapshot describes its moment, so a reservation made after it is not its business.
  if (!describedBy(reservation, input.snapshot.asOf)) {
    return held === undefined
      ? NONE
      : {kind: 'note', note: {kind: 'listed_after_as_of', invoiceId}};
  }
  if (held === undefined) return stepForOmitted(reservation, input);
  return stepForListed(entry, held);
};

/**
 * AC-27 and ADR-0010: omitted means gone at `asOf`, unless it is too close to `asOf` to be sure.
 * The window exists because two clocks are compared; a reservation a snapshot created carries the
 * treasury's own moment, so there is nothing to allow for (ADR-0010, amended 2026-09-25).
 */
// Only active reservations reach here unlisted: `local` is the active ones plus the listed ones.
const stepForOmitted = (reservation: Reservation, input: ReconciliationInput): Step => {
  const releasableBefore = input.snapshot.asOf.getTime() - input.keepWindowMs;
  if (reservation.source === 'client' && reservation.createdAt.getTime() >= releasableBefore) {
    return {kind: 'note', note: {kind: 'kept_within_window', invoiceId: reservation.invoiceId}};
  }
  return {kind: 'changed', reservation, deltaHeld: reservation.releaseByAdjustment()};
};

/** ADR-0012, 2A and 3A: the snapshot's figure plus what the client did after its moment. */
const stepForListed = (entry: LocalReservation, held: Money): Step => {
  const {reservation} = entry;
  // A-12, review round 1: a reservation from before a re-denomination is closed and in the old
  // currency. Reopening it would mix two currencies (INV-08), so the listing is logged and left.
  if (reservation.held.currency !== held.currency) {
    return {
      kind: 'note',
      note: {kind: 'listed_in_other_currency', invoiceId: reservation.invoiceId},
    };
  }
  const target = held.amount + entry.deltaHeldAfterAsOf;
  const targetHeld = Money.of(target < 0n ? 0n : target, held.currency);
  if (reservation.status === 'active') {
    const deltaHeld = reservation.correctTo(targetHeld);
    return deltaHeld === 0n ? NONE : {kind: 'changed', reservation, deltaHeld};
  }
  if (entry.closedByClientAfterAsOf) {
    return {
      kind: 'note',
      note: {kind: 'kept_closed_after_as_of', invoiceId: reservation.invoiceId},
    };
  }
  if (targetHeld.isZero()) return NONE;
  return {kind: 'changed', reservation, deltaHeld: reservation.reopenTo(targetHeld)};
};

/**
 * Created before `asOf`, or created by a snapshot at or before it. A snapshot's reservation is
 * dated by the treasury's clock (ADR-0011), so a later statement of the same moment supersedes it,
 * as A-13 clause 7 says for the rest of the snapshot (ADR-0010, amended 2026-09-25).
 */
const describedBy = (reservation: Reservation, asOf: Date): boolean => {
  const createdAt = reservation.createdAt.getTime();
  if (createdAt < asOf.getTime()) return true;
  return reservation.source === 'reconciliation' && createdAt === asOf.getTime();
};
