import {defineConfig} from 'prisma/config';

// Prisma 7 keeps connection URLs out of the schema: the CLI reads them here, the client gets a
// driver adapter (ADR-0002). The URL stays optional so that `prisma generate`, which never opens
// a connection, also runs during the image build where no database exists yet.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {path: 'prisma/migrations'},
  datasource: {url: process.env.DATABASE_URL ?? ''},
});
