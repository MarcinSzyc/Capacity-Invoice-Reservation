import {CapacityMovement} from '../../domain/capacity-movement';
import {LedgerRepository} from '../../domain/ports/ledger.repository';
import {Clock} from '../../domain/ports/clock';
import {ProgramRepository} from '../../domain/ports/program.repository';
import {ReservationRepository} from '../../domain/ports/reservation.repository';
import {
  TreasuryMessageRecord,
  TreasuryMessageStore,
} from '../../domain/ports/treasury-message-store';
import {CapacityRepositories, UnitOfWork} from '../../domain/ports/unit-of-work';
import {Program} from '../../domain/program';
import {Reservation} from '../../domain/reservation';

/** Working in-memory adapters for the capacity ports: arrays and maps, no call expectations. */
export class InMemoryPrograms implements ProgramRepository {
  readonly byId = new Map<string, Program>();

  findById(programId: string): Promise<Program | null> {
    return Promise.resolve(this.byId.get(programId) ?? null);
  }

  lockById(programId: string): Promise<Program | null> {
    return this.findById(programId);
  }

  save(program: Program): Promise<void> {
    this.byId.set(program.programId, program);
    return Promise.resolve();
  }
}

export class InMemoryReservations implements ReservationRepository {
  readonly all: Reservation[] = [];

  findByInvoice(programId: string, invoiceId: string): Promise<Reservation | null> {
    const found = this.all.find((r) => r.programId === programId && r.invoiceId === invoiceId);
    return Promise.resolve(found ?? null);
  }

  add(reservation: Reservation): Promise<void> {
    this.all.push(reservation);
    return Promise.resolve();
  }

  findActiveByProgram(programId: string): Promise<Reservation[]> {
    return Promise.resolve(
      this.all.filter((r) => r.programId === programId && r.status === 'active'),
    );
  }
}

/** A clock that answers the moment it was given, so `createdAt` can be asserted exactly. */
export class FixedClock implements Clock {
  constructor(private moment: Date) {}

  now(): Date {
    return this.moment;
  }

  set(moment: Date): void {
    this.moment = moment;
  }
}

export class InMemoryLedger implements LedgerRepository {
  readonly movements: CapacityMovement[] = [];

  append(movement: CapacityMovement): Promise<void> {
    this.movements.push(movement);
    return Promise.resolve();
  }
}

export interface StoredTreasuryMessage extends TreasuryMessageRecord {
  duplicateCount: number;
}

export class InMemoryTreasuryMessages implements TreasuryMessageStore {
  readonly byId = new Map<string, StoredTreasuryMessage>();

  wasProcessed(messageId: string): Promise<boolean> {
    return Promise.resolve(this.byId.has(messageId));
  }

  recordOutcome(record: TreasuryMessageRecord): Promise<void> {
    this.byId.set(record.messageId, {...record, duplicateCount: 0});
    return Promise.resolve();
  }

  recordDuplicate(messageId: string): Promise<void> {
    const stored = this.byId.get(messageId);
    if (stored) stored.duplicateCount += 1;
    return Promise.resolve();
  }
}

/**
 * Runs the work against the shared fakes. Rollback is simulated by snapshotting and restoring,
 * so a use case that throws leaves the fakes as they were, like a real transaction would.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  private depth = 0;

  constructor(readonly repositories: CapacityRepositories & InMemoryRepositories) {}

  /** Whether some work is running right now, so a test can see what happens inside one. */
  get inTransaction(): boolean {
    return this.depth > 0;
  }

  async run<T>(work: (repositories: CapacityRepositories) => Promise<T>): Promise<T> {
    const snapshot = this.snapshot();
    this.depth += 1;
    try {
      return await work(this.repositories);
    } catch (error: unknown) {
      this.restore(snapshot);
      throw error;
    } finally {
      this.depth -= 1;
    }
  }

  private snapshot(): Snapshot {
    const {programs, reservations, ledger, treasuryMessages} = this.repositories;
    return {
      programs: new Map(programs.byId),
      reservations: [...reservations.all],
      movements: [...ledger.movements],
      messages: new Map([...treasuryMessages.byId].map(([id, m]) => [id, {...m}])),
    };
  }

  private restore(snapshot: Snapshot): void {
    const {programs, reservations, ledger, treasuryMessages} = this.repositories;
    programs.byId.clear();
    snapshot.programs.forEach((program, id) => programs.byId.set(id, program));
    reservations.all.splice(0, reservations.all.length, ...snapshot.reservations);
    ledger.movements.splice(0, ledger.movements.length, ...snapshot.movements);
    treasuryMessages.byId.clear();
    snapshot.messages.forEach((message, id) => treasuryMessages.byId.set(id, message));
  }
}

interface InMemoryRepositories {
  programs: InMemoryPrograms;
  reservations: InMemoryReservations;
  ledger: InMemoryLedger;
  treasuryMessages: InMemoryTreasuryMessages;
}

interface Snapshot {
  programs: Map<string, Program>;
  reservations: Reservation[];
  movements: CapacityMovement[];
  messages: Map<string, StoredTreasuryMessage>;
}

export const inMemoryCapacity = (): InMemoryUnitOfWork =>
  new InMemoryUnitOfWork({
    programs: new InMemoryPrograms(),
    reservations: new InMemoryReservations(),
    ledger: new InMemoryLedger(),
    treasuryMessages: new InMemoryTreasuryMessages(),
  });
