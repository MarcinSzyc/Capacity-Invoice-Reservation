import {JsonLogger} from '../common/logging/json-logger';
import {loadConfig} from '../config/configuration';
import {PrismaService} from './prisma.service';

const UNREACHABLE_DATABASE = 'postgresql://nobody:nobody@127.0.0.1:1/nothing';

describe('PrismaService', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService(loadConfig(process.env), new JsonLogger());
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('should open a connection to the database and answer a query', async () => {
    const rows = await prisma.withClient((client) => client.$queryRaw`SELECT 1 AS one`);

    expect(rows).toEqual([{one: 1}]);
  });

  it('should report itself reachable while the database answers', async () => {
    await expect(prisma.isReachable()).resolves.toBe(true);
  });

  it('should report itself unreachable when the database is not there', async () => {
    const detached = new PrismaService(
      loadConfig({...process.env, DATABASE_URL: UNREACHABLE_DATABASE}),
      new JsonLogger(),
    );

    await expect(detached.isReachable()).resolves.toBe(false);

    await detached.onModuleDestroy();
  });

  it('should survive a database that is not there when the module starts', async () => {
    const detached = new PrismaService(
      loadConfig({...process.env, DATABASE_URL: UNREACHABLE_DATABASE}),
      new JsonLogger(),
    );

    // Readiness reports it down, boot does not die (the slice promises 503 until both answer).
    await expect(detached.onModuleInit()).resolves.toBeUndefined();
    await expect(detached.isReachable()).resolves.toBe(false);

    await detached.onModuleDestroy();
  });
});
