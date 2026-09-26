import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {App} from './app';

const PROGRAM_ID = 'PRG-1';
const OTHER_PROGRAM_ID = 'PRG-2';
const TOKEN = 'token-for-the-page';
const AVAILABILITY = {
  programId: PROGRAM_ID,
  currency: 'USD',
  limit: 1_000_000_000,
  reserved: 0,
  available: 1_000_000_000,
  overcommitted: false,
  asOf: null,
};
const CAPACITY_EXCEEDED = {code: 'CAPACITY_EXCEEDED', message: 'not enough', available: 0};

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});

const pathOf = (request: string | URL | Request): string =>
  new URL(request instanceof Request ? request.url : request).pathname;

/** The api as the page sees it: every route it calls, answered from fixtures. */
const fakeApi = (request: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const path = pathOf(request);
  const method = init?.method ?? 'GET';
  if (path === '/dev/token') return Promise.resolve(json(200, {token: TOKEN}));
  if (path === `/programs/${PROGRAM_ID}/availability`) {
    return Promise.resolve(json(200, AVAILABILITY));
  }
  if (path === `/dev/programs/${PROGRAM_ID}/movements`) {
    return Promise.resolve(json(200, {programId: PROGRAM_ID, currency: 'USD', movements: []}));
  }
  if (method === 'POST' && path === `/programs/${PROGRAM_ID}/reservations`) {
    return Promise.resolve(json(422, CAPACITY_EXCEEDED));
  }
  return Promise.resolve(json(404, {code: 'NOT_FOUND'}));
};

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(fakeApi));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('should render the page title', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', {name: /Program Capacity & Invoice Reservation/i}),
    ).toBeInTheDocument();
  });

  it('should link to the health endpoint and both documentation views of the api', () => {
    render(<App />);

    const targets = screen.getAllByRole('link').map((link) => link.getAttribute('href'));

    expect(targets).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/health'),
        expect.stringContaining('/docs'),
        expect.stringContaining('/redoc'),
      ]),
    );
  });

  it('[AC-38] should show the request generator, the request log, the live ledger and the treasury panel', () => {
    const {container} = render(<App />);

    for (const id of ['generator', 'request-log', 'ledger', 'treasury']) {
      expect(container.querySelector(`section#${id}`)).not.toBeNull();
    }
    const generator = within(screen.getByRole('region', {name: 'Request generator'}));
    expect(generator.getByRole('button', {name: 'Start'})).toBeInTheDocument();
    expect(screen.getByRole('region', {name: 'Request log'})).toBeInTheDocument();
    expect(screen.getByRole('region', {name: 'Live ledger'})).toBeInTheDocument();
    const treasury = within(screen.getByRole('region', {name: 'Treasury panel'}));
    for (const action of ['Send', 'Duplicate', 'Stale']) {
      expect(treasury.getByRole('button', {name: action})).toBeInTheDocument();
    }
  });

  it('[AC-38] should log each call with its method, path, status and error code', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', {name: 'One request'}));

    const log = within(screen.getByRole('region', {name: 'Request log'}));
    const row = await log.findByRole('row', {name: /reservations/});
    expect(within(row).getByText('POST')).toBeInTheDocument();
    expect(within(row).getByText(`/programs/${PROGRAM_ID}/reservations`)).toBeInTheDocument();
    expect(within(row).getByText('422')).toBeInTheDocument();
    expect(within(row).getByText('CAPACITY_EXCEEDED')).toBeInTheDocument();
  });

  it('should ignore a poll answer for a program id no longer shown', async () => {
    let answerSlowProgram: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((request: string | URL | Request, init?: RequestInit) => {
        const path = pathOf(request);
        if (path === `/programs/${PROGRAM_ID}/availability`) {
          return new Promise<Response>((resolve) => {
            answerSlowProgram = resolve;
          });
        }
        return fakeApi(request, init);
      }),
    );
    render(<App />);

    fireEvent.change(screen.getByLabelText('Program'), {target: {value: OTHER_PROGRAM_ID}});
    await screen.findByText(/PRG-2 doesn't exist yet/);
    answerSlowProgram(json(200, AVAILABILITY));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.getByText(/doesn't exist yet/)).toBeInTheDocument();
  });

  it('should show no availability for a body that is not one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((request: string | URL | Request, init?: RequestInit) => {
        const path = pathOf(request);
        if (path === `/programs/${PROGRAM_ID}/availability`) {
          return Promise.resolve(json(200, {programId: PROGRAM_ID, limit: 'a lot'}));
        }
        return fakeApi(request, init);
      }),
    );
    render(<App />);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.getByText(/doesn't exist yet/)).toBeInTheDocument();
    expect(screen.queryByText('a lot')).toBeNull();
  });

  it('should reset the ledger after a confirmation and start the request log again', async () => {
    const fetchMock = vi.fn(fakeApi);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', () => true);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', {name: 'One request'}));
    const log = within(screen.getByRole('region', {name: 'Request log'}));
    await log.findByRole('row', {name: /reservations/});

    fireEvent.click(screen.getByRole('button', {name: 'Reset'}));

    await log.findByRole('row', {name: /\/dev\/reset/});
    expect(log.queryByRole('row', {name: /reservations/})).toBeNull();
    const calls = fetchMock.mock.calls.map(([request, init]) => [pathOf(request), init?.method]);
    expect(calls).toContainEqual(['/dev/reset', 'POST']);
  });

  it('should leave everything as it is when the reset is not confirmed', async () => {
    const fetchMock = vi.fn(fakeApi);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', () => false);
    render(<App />);

    fireEvent.click(await screen.findByRole('button', {name: 'Reset'}));

    const paths = fetchMock.mock.calls.map(([request]) => pathOf(request));
    expect(paths).not.toContain('/dev/reset');
  });

  it('should clear the request log on the page without calling api', async () => {
    const fetchMock = vi.fn(fakeApi);
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', {name: 'One request'}));
    const log = within(screen.getByRole('region', {name: 'Request log'}));
    await log.findByRole('row', {name: /reservations/});
    const callsBefore = fetchMock.mock.calls.length;

    fireEvent.click(log.getByRole('button', {name: 'Clear'}));

    expect(log.queryByRole('row', {name: /reservations/})).toBeNull();
    const newCalls = fetchMock.mock.calls.slice(callsBefore).map(([request]) => pathOf(request));
    expect(newCalls.every((path) => !path.startsWith('/dev/reset'))).toBe(true);
  });
});
