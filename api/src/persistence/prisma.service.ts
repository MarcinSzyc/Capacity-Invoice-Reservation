import {Inject, Injectable, OnModuleDestroy, OnModuleInit} from '@nestjs/common';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../generated/prisma/client';
import {JsonLogger} from '../common/logging/json-logger';
import {APP_CONFIG, AppConfig} from '../config/config.module';
import {probeWithin} from '../health/probe-within';

const CONTEXT = 'PrismaService';
const CONNECT_TIMEOUT_MS = 5_000;

/**
 * Owns the single Prisma connection. It holds the client rather than extending it, so the ORM
 * is reached through one named door (`withClient`) instead of the service being the ORM. That
 * is a readability boundary, not a security one: `withClient` hands the caller the real client.
 * What actually keeps the ORM out of `domain/` and `application/` is the lint rule in
 * `eslint.config.mjs` (CLAUDE.md §2, ADR-0002), which is where the guarantee lives.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient;

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly logger: JsonLogger,
  ) {
    this.client = new PrismaClient({
      adapter: new PrismaPg({connectionString: config.databaseUrl}),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      // Bounded for the same reason the readiness probes are: a refused address fails at once,
      // but a black holed one never answers, and an unbounded connect would stall boot so that
      // neither liveness nor readiness ever replies.
      const connected = await probeWithin(CONNECT_TIMEOUT_MS, async () => {
        await this.client.$connect();
        return true;
      });
      if (!connected) this.logger.warn('database did not answer while connecting at boot', CONTEXT);
    } catch (reason: unknown) {
      // A database that is not up yet must not kill the process: readiness answers 503 with
      // `database: down` until it answers, which is what the slice promises and how the broker
      // already behaves. Prisma connects lazily on the first query, so a database that arrives
      // late needs no restart.
      const failure = reason instanceof Error ? reason : new Error(String(reason));
      this.logger.warn(`database is not reachable at boot: ${failure.message}`, CONTEXT);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  async isReachable(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /** The one door to the ORM, for repositories under `infrastructure/` only. */
  withClient<T>(work: (client: PrismaClient) => Promise<T>): Promise<T> {
    return work(this.client);
  }
}
