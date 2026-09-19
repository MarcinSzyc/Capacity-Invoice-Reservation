import {Inject, Injectable, OnModuleDestroy, OnModuleInit} from '@nestjs/common';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../generated/prisma/client';
import {APP_CONFIG, AppConfig} from '../config/config.module';

/**
 * Owns the single Prisma connection. It holds the client rather than extending it (the Nest
 * recipe extends PrismaClient, CLAUDE.md §2 is stricter: nothing outside infrastructure sees the
 * ORM), so injecting this service does not hand the whole query API to a use case. Repositories
 * arriving in S-02 live in infrastructure and reach the client through `withClient`.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = new PrismaClient({
      adapter: new PrismaPg({connectionString: config.databaseUrl}),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
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
