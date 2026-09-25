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

const codeOf = (body: unknown): string | null =>
  isRecord(body) && typeof body.code === 'string' ? body.code : null;

export const isRecord = (body: unknown): body is Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body);

/** A-19's read model as the ledger panel shows it; anything else reads as "not there". */
export interface Availability {
  readonly currency: string;
  readonly limit: number;
  readonly reserved: number;
  readonly available: number;
  readonly overcommitted: boolean;
  readonly asOf: string | null;
}

export interface Movement {
  readonly kind: string;
  readonly amount: number;
  readonly limitAfter: number;
  readonly reservedAfter: number;
  readonly availableAfter: number;
  readonly releaseId: string | null;
  readonly clientId: string | null;
  readonly messageId: string | null;
  readonly occurredAt: string;
}

const isTextOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

const isInteger = (value: unknown): value is number => Number.isInteger(value);

export const availabilityOf = (body: unknown): Availability | null => {
  if (!isRecord(body)) return null;
  const {currency, limit, reserved, available, overcommitted, asOf} = body;
  if (typeof currency !== 'string' || typeof overcommitted !== 'boolean') return null;
  if (!isInteger(limit) || !isInteger(reserved) || !isInteger(available)) return null;
  if (!isTextOrNull(asOf)) return null;
  return {currency, limit, reserved, available, overcommitted, asOf};
};

const isMovement = (row: unknown): row is Movement => {
  if (!isRecord(row) || typeof row.kind !== 'string' || typeof row.occurredAt !== 'string') {
    return false;
  }
  const amounts = [row.amount, row.limitAfter, row.reservedAfter, row.availableAfter];
  const texts = [row.releaseId, row.clientId, row.messageId];
  return amounts.every(isInteger) && texts.every(isTextOrNull);
};

export const movementsOf = (body: unknown): Movement[] => {
  if (!isRecord(body) || !Array.isArray(body.movements)) return [];
  return body.movements.filter(isMovement);
};

const tokenOf = (body: unknown): string =>
  typeof body === 'object' && body !== null && 'token' in body && typeof body.token === 'string'
    ? body.token
    : '';

/** A body that is not JSON, such as a proxy's error page, is shown as having no code. */
const jsonOrNull = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

/** Talks to api with a dev token (glossary: Dev endpoint) and reports each logged call. */
export const createApi = (baseUrl: string, onCall: (record: CallRecord) => void): Api => {
  let token: Promise<string> | undefined;
  let calls = 0;

  const bearer = (): Promise<string> => {
    // An empty answer is not kept: the next call asks again rather than going tokenless for good.
    token ??= fetch(`${baseUrl}/dev/token`)
      .then((response) => response.json())
      .then(tokenOf)
      .catch(() => '')
      .then((issued) => {
        if (issued === '') token = undefined;
        return issued;
      });
    return token;
  };

  const call = async (method: string, path: string, body?: unknown): Promise<Answer> => {
    const headers: Record<string, string> = {Authorization: `Bearer ${await bearer()}`};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    }).catch(() => null);
    if (response === null) return {status: UNREACHABLE, body: {code: 'API_UNREACHABLE'}};
    return {status: response.status, body: jsonOrNull(await response.text())};
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
