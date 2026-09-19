#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';

// NestJS 12 ships as ES modules (ADR-0001). Jest evaluates them only with Node's VM modules
// flag, which has to be set when the process starts, so the real run happens in a child.
const jest = createRequire(import.meta.url).resolve('jest/bin/jest');
const {status} = spawnSync(
  process.execPath,
  ['--experimental-vm-modules', jest, ...process.argv.slice(2)],
  {stdio: 'inherit'},
);

process.exit(status ?? 1);
