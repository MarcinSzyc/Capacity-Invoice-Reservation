import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Answer, Api} from './api';
import {Generator} from './generator';

const PROGRAM_A = 'PRG-A';
const PROGRAM_B = 'PRG-B';
const USD = 'USD';
// Math.random below this picks a reservation, at or above it a release when one is possible.
const PICK_RELEASE = 0.9;

interface Sent {
  readonly method: string;
  readonly path: string;
}

/** The api as the generator sees it: every call recorded, answered the way a real one would. */
class FakeApi implements Api {
  readonly sent: Sent[] = [];

  send(method: 'GET' | 'POST', path: string): Promise<Answer> {
    this.sent.push({method, path});
    if (path.endsWith('/releases')) return Promise.resolve({status: 200, body: {status: 'closed'}});
    return Promise.resolve({status: 201, body: {status: 'active'}});
  }

  read(): Promise<Answer> {
    return Promise.resolve({status: 200, body: null});
  }
}

const oneRequest = async (): Promise<void> => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', {name: 'One request'}));
    await Promise.resolve();
  });
};

describe('Generator', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(PICK_RELEASE);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should release each invoice on the program that holds it after the program id changes', async () => {
    const api = new FakeApi();
    const {rerender} = render(<Generator api={api} programId={PROGRAM_A} currency={USD} />);
    await oneRequest();

    rerender(<Generator api={api} programId={PROGRAM_B} currency={USD} />);
    await oneRequest();
    rerender(<Generator api={api} programId={PROGRAM_A} currency={USD} />);
    await oneRequest();

    expect(api.sent.map(({path}) => path.replace(/INV-[a-z0-9]+/, 'INV'))).toEqual([
      `/programs/${PROGRAM_A}/reservations`,
      `/programs/${PROGRAM_B}/reservations`,
      `/programs/${PROGRAM_A}/reservations/INV/releases`,
    ]);
  });

  it('should send a request every second while running and none after stop', async () => {
    vi.useFakeTimers();
    const api = new FakeApi();
    const {rerender} = render(<Generator api={api} programId={PROGRAM_A} currency={USD} />);

    fireEvent.click(screen.getByRole('button', {name: 'Start'}));
    await act(() => vi.advanceTimersByTimeAsync(1_500));
    rerender(<Generator api={api} programId={PROGRAM_A} currency="EUR" />);
    await act(() => vi.advanceTimersByTimeAsync(1_500));
    const whileRunning = api.sent.length;
    fireEvent.click(screen.getByRole('button', {name: 'Stop'}));
    await act(() => vi.advanceTimersByTimeAsync(3_000));

    expect(whileRunning).toBe(3);
    expect(api.sent).toHaveLength(whileRunning);
  });
});
