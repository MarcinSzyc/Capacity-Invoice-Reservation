// The only thing web knows about api is its address. Every number it shows was computed there.
export const apiBaseUrl = (): string =>
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/** One call as the request log shows it: what was sent and what api answered. */
export interface CallRecord {
  readonly id: number;
  readonly at: string;
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly code: string | null;
}

export interface Answer {
  readonly status: number;
  readonly body: unknown;
}

export interface Api {
  /** A call the request log shows: the generator's and the treasury panel's. */
  send(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Answer>;
  /** A read the page polls. Not logged, or the log would be nothing but polls. */
  read(path: string): Promise<Answer>;
}

// A status the network never answers, so a call that did not reach api reads as what it is.
const UNREACHABLE = 0;

const codeOf = (body: unknown): string | null => {
  if (typeof body !== 'object' || body === null || !('code' in body)) return null;
  return typeof body.code === 'string' ? body.code : null;
};

const tokenOf = (body: unknown): string =>
  typeof body === 'object' && body !== null && 'token' in body && typeof body.token === 'string'
    ? body.token
    : '';

/** Talks to api with a dev token (glossary: Dev endpoint) and reports each logged call. */
export const createApi = (baseUrl: string, onCall: (record: CallRecord) => void): Api => {
  let token: Promise<string> | undefined;
  let calls = 0;

  const bearer = (): Promise<string> => {
    token ??= fetch(`${baseUrl}/dev/token`)
      .then((response) => response.json())
      .then(tokenOf)
      .catch(() => {
        token = undefined;
        return '';
      });
    return token;
  };

  const call = async (method: string, path: string, body?: unknown): Promise<Answer> => {
    const headers: Record<string, string> = {Authorization: `Bearer ${await bearer()}`};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
      });
      const text = await response.text();
      return {status: response.status, body: text === '' ? null : (JSON.parse(text) as unknown)};
    } catch {
      return {status: UNREACHABLE, body: {code: 'API_UNREACHABLE'}};
    }
  };

  return {
    send: async (method, path, body) => {
      const answer = await call(method, path, body);
      calls += 1;
      onCall({
        id: calls,
        at: new Date().toISOString(),
        method,
        path,
        status: answer.status,
        code: codeOf(answer.body),
      });
      return answer;
    },
    read: (path) => call('GET', path),
  };
};
