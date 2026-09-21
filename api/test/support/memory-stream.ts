import {Writable} from 'node:stream';

/** Collects everything written to it, one string per write, so tests can read log lines back. */
export class MemoryStream extends Writable {
  readonly chunks: string[] = [];

  override _write(chunk: unknown, _encoding: string, done: () => void): void {
    this.chunks.push(String(chunk));
    done();
  }

  /** Every line parsed as JSON; a line that is not JSON fails the test that asked. */
  lines(): Record<string, unknown>[] {
    return this.chunks
      .flatMap((chunk) => chunk.split('\n'))
      .filter((line) => line !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }
}
