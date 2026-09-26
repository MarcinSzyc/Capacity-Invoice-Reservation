import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import type {Answer, Api, SendOptions} from './api';
import {ResilienceScenarios} from './resilience-scenarios';

const PROGRAM_ID = 'PRG-1';
const USD = 'USD';
const LIMIT = 1_000;

interface Sent {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  readonly authorize: boolean;
}

type Script = (sent: Sent, index: number) => Answer;

/** The api as a scenario sees it: every call recorded, answered by the script of the test. */
class ScriptedApi implements Api {
  readonly sent: Sent[] = [];

  constructor(
    private readonly script: Script,
    private readonly availability: () => Answer,
  ) {}

  send(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    options?: SendOptions,
  ): Promise<Answer> {
    const sent = {method, path, body, authorize: options?.authorize ?? true};
    this.sent.push(sent);
    return Promise.resolve(this.script(sent, this.sent.length - 1));
  }

  read(path: string): Promise<Answer> {
    if (path.endsWith('/availability')) return Promise.resolve(this.availability());
    return Promise.resolve({status: 200, body: {held: 100}});
  }
}

const availability = (reserved: number): Answer => ({
  status: 200,
  body: {
    currency: USD,
    limit: LIMIT,
    reserved,
    available: LIMIT - reserved,
    overcommitted: false,
    asOf: null,
  },
});

const row = (title: string): HTMLElement => screen.getByRole('group', {name: title});

const run = async (title: string): Promise<string> => {
  await act(async () => {
    fireEvent.click(within(row(title)).getByRole('button', {name: 'Run'}));
    for (let tick = 0; tick < 10; tick += 1) await Promise.resolve();
  });
  return within(row(title)).getByTestId('outcome').textContent ?? '';
};

describe('ResilienceScenarios', () => {
  afterEach(() => {
    cleanup();
  });

  it('should pass the stampede when capacity is never exceeded and the rest are refused', async () => {
    let reads = 0;
    const api = new ScriptedApi(
      (_sent, index) =>
        index < 10
          ? {status: 201, body: {status: 'active'}}
          : {status: 422, body: {code: 'CAPACITY_EXCEEDED'}},
      () => availability(reads++ === 0 ? 0 : LIMIT),
    );
    render(<ResilienceScenarios api={api} programId={PROGRAM_ID} currency={USD} />);

    const outcome = await run('Stampede');

    expect(api.sent).toHaveLength(25);
    expect(outcome).toContain('✓');
    expect(outcome).toContain('10 × 201');
    expect(outcome).toContain('15 × 422');
  });

  it('should fail the stampede when the program ends above its limit', async () => {
    let reads = 0;
    const api = new ScriptedApi(
      () => ({status: 201, body: {status: 'active'}}),
      () => availability(reads++ === 0 ? 0 : LIMIT + 1),
    );
    render(<ResilienceScenarios api={api} programId={PROGRAM_ID} currency={USD} />);

    expect(await run('Stampede')).toContain('✗');
  });

  it('should pass the repeated payment when one release applies and the repeat is refused', async () => {
    let releases = 0;
    const api = new ScriptedApi(
      (sent) => {
        if (sent.path.endsWith('/reservations')) return {status: 201, body: {status: 'active'}};
        releases += 1;
        return releases === 1
          ? {status: 200, body: {status: 'closed'}}
          : {status: 409, body: {code: 'RELEASE_ALREADY_PROCESSED'}};
      },
      () => availability(0),
    );
    render(<ResilienceScenarios api={api} programId={PROGRAM_ID} currency={USD} />);

    const outcome = await run('Repeated payment');

    const sentReleases = api.sent.filter(({path}) => path.endsWith('/releases'));
    expect(sentReleases).toHaveLength(2);
    expect(sentReleases[0]?.body).toEqual(sentReleases[1]?.body);
    expect(outcome).toContain('✓');
  });

  it('should send the garbage requests, one without a token, and pass when each is refused', async () => {
    const api = new ScriptedApi(
      (sent) =>
        sent.authorize
          ? {status: 400, body: {code: 'VALIDATION_FAILED'}}
          : {status: 401, body: {code: 'UNAUTHORIZED'}},
      () => availability(0),
    );
    render(<ResilienceScenarios api={api} programId={PROGRAM_ID} currency={USD} />);

    const outcome = await run('Garbage and no token');

    expect(api.sent.map(({authorize}) => authorize)).toEqual([true, true, true, false]);
    expect(outcome).toContain('✓');
  });

  it('should say the program does not exist instead of running on nothing', async () => {
    const api = new ScriptedApi(
      () => ({status: 201, body: null}),
      () => ({status: 404, body: {code: 'PROGRAM_NOT_FOUND'}}),
    );
    render(<ResilienceScenarios api={api} programId={PROGRAM_ID} currency={USD} />);

    const outcome = await run('Stampede');

    expect(api.sent).toHaveLength(0);
    expect(outcome).toContain(`${PROGRAM_ID} does not exist`);
    expect(outcome).toContain('Could not run');
  });

  it('should say a scenario could not run, not that api failed, when the program is full', async () => {
    const api = new ScriptedApi(
      () => ({status: 422, body: {code: 'CAPACITY_EXCEEDED'}}),
      () => availability(LIMIT),
    );
    render(<ResilienceScenarios api={api} programId={PROGRAM_ID} currency={USD} />);

    const outcome = await run('Same invoice twice');

    expect(outcome).toContain('Could not run');
    expect(outcome).toContain('no free capacity');
    expect(outcome).not.toContain('✗');
  });
});
