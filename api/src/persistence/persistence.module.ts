import {Module} from '@nestjs/common';
import {PrismaService} from './prisma.service';

// Not @Global: the Nest docs advise the imports array over global modules, and a module that
// wants the database should say so (CLAUDE.md §2).
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PersistenceModule {}
