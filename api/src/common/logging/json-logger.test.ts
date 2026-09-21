import {MemoryStream} from '../../../test/support/memory-stream';
import {JsonLogger} from './json-logger';

const CONTEXT = 'Test';

const captureLine = (write: () => void): Record<string, unknown> => {
  const written: string[] = [];
  const spy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    written.push(String(chunk));
    return true;
  });

  write();
  spy.mockRestore();

  return JSON.parse(written[0] ?? '{}') as Record<string, unknown>;
};

describe('JsonLogger', () => {
  it('should write to the stream it is given, one JSON line per call', () => {
    const stream = new MemoryStream();

    new JsonLogger(stream).log('first', CONTEXT);
    new JsonLogger(stream).warn('second', CONTEXT);

    expect(stream.chunks).toHaveLength(2);
    expect(JSON.parse(stream.chunks[0] ?? '')).toMatchObject({message: 'first', level: 'info'});
    expect(JSON.parse(stream.chunks[1] ?? '')).toMatchObject({message: 'second', level: 'warn'});
  });

  it('should write a message that carries a bigint, which money is (ADR-0001)', () => {
    const line = captureLine(() => new JsonLogger().log({reservedAmount: 1_200_000n}, CONTEXT));

    expect(line.message).toContain('1200000');
    expect(line.context).toBe(CONTEXT);
  });

  it('should write a line for a message that is not a string at all', () => {
    const line = captureLine(() => new JsonLogger().log(undefined, CONTEXT));

    expect(line.message).toBe('undefined');
  });

  it('should log an Error by its message, not by its fields', () => {
    const line = captureLine(() => new JsonLogger().log(new Error('it went wrong'), CONTEXT));

    expect(line.message).toBe('it went wrong');
  });

  it('should keep a string message as it is', () => {
    const line = captureLine(() => new JsonLogger().log('plain words', CONTEXT));

    expect(line.message).toBe('plain words');
    expect(line.level).toBe('info');
  });
});
