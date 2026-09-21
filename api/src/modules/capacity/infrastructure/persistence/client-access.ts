import type {Prisma} from '../../../../generated/prisma/client';

/** What a repository needs from the database: a client for one statement, or a transaction's. */
export interface ClientAccess {
  withClient<T>(work: (client: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}

/** Binds every repository built on it to one open transaction. */
export class TransactionScope implements ClientAccess {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  withClient<T>(work: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return work(this.transaction);
  }
}
