import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {App} from './app';

const PROGRAM_ID = 'PRG-1';
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

/** The api as the page sees it: every route it calls, answered from fixtures. */
const fakeApi = (request: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const path = new URL(request instanceof Request ? request.url : request).pathname;
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
    for (const action of ['Limit change', 'Snapshot', 'Duplicate', 'Stale']) {
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
});
