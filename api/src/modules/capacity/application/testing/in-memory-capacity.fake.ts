import {CapacityMovement} from '../../domain/capacity-movement';
import {LedgerRepository} from '../../domain/ports/ledger.repository';
import {ProgramRepository} from '../../domain/ports/program.repository';
import {
  TreasuryMessageRecord,
  TreasuryMessageStore,
} from '../../domain/ports/treasury-message-store';
import {CapacityRepositories, UnitOfWork} from '../../domain/ports/unit-of-work';
import {Program} from '../../domain/program';

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
  constructor(readonly repositories: CapacityRepositories & InMemoryRepositories) {}

  async run<T>(work: (repositories: CapacityRepositories) => Promise<T>): Promise<T> {
    const snapshot = this.snapshot();
    try {
      return await work(this.repositories);
    } catch (error: unknown) {
      this.restore(snapshot);
      throw error;
    }
  }

  private snapshot(): Snapshot {
    const {programs, ledger, treasuryMessages} = this.repositories;
    return {
      programs: new Map(programs.byId),
      movements: [...ledger.movements],
      messages: new Map([...treasuryMessages.byId].map(([id, m]) => [id, {...m}])),
    };
  }

  private restore(snapshot: Snapshot): void {
    const {programs, ledger, treasuryMessages} = this.repositories;
    programs.byId.clear();
    snapshot.programs.forEach((program, id) => programs.byId.set(id, program));
    ledger.movements.splice(0, ledger.movements.length, ...snapshot.movements);
    treasuryMessages.byId.clear();
    snapshot.messages.forEach((message, id) => treasuryMessages.byId.set(id, message));
  }
}

interface InMemoryRepositories {
  programs: InMemoryPrograms;
  ledger: InMemoryLedger;
  treasuryMessages: InMemoryTreasuryMessages;
}

interface Snapshot {
  programs: Map<string, Program>;
  movements: CapacityMovement[];
  messages: Map<string, StoredTreasuryMessage>;
}

export const inMemoryCapacity = (): InMemoryUnitOfWork =>
  new InMemoryUnitOfWork({
    programs: new InMemoryPrograms(),
    ledger: new InMemoryLedger(),
    treasuryMessages: new InMemoryTreasuryMessages(),
  });
