import {afterEach, describe, expect, it, vi} from 'vitest';
import {CallRecord, createApi} from './api';

const BASE_URL = 'http://api.test';

describe('createApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should log the real status of an answer that is not JSON and ask for a token again after an empty one', async () => {
    const tokenCalls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/dev/token')) {
          tokenCalls.push(url);
          return Promise.resolve(new Response(JSON.stringify({}), {status: 200}));
        }
        return Promise.resolve(new Response('<html>bad gateway</html>', {status: 502}));
      }),
    );
    const calls: CallRecord[] = [];
    const api = createApi(BASE_URL, (call) => calls.push(call));

    await api.send('GET', '/programs/PRG-1/availability');
    await api.send('GET', '/programs/PRG-1/availability');

    expect(calls.map(({status, code}) => [status, code])).toEqual([
      [502, null],
      [502, null],
    ]);
    expect(tokenCalls).toHaveLength(2);
  });
});
