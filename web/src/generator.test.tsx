import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Answer, Api} from './api';
import {Generator} from './generator';
import {ReleaseGenerator} from './release-generator';
import {useReservedInvoices} from './reserved-invoices';

const PROGRAM_A = 'PRG-A';
const PROGRAM_B = 'PRG-B';
const USD = 'USD';
// Math.random below this picks a reservation, at or above it a release when one is possible.
const PICK_RELEASE = 0.9;

interface Sent {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

/** The api as the generator sees it: every call recorded, answered the way a real one would. */
class FakeApi implements Api {
  readonly sent: Sent[] = [];

  send(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Answer> {
    this.sent.push({method, path, body});
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

/** Both generators sharing one list of reserved invoices, as the page wires them. */
const Generators = ({
  api,
  programId,
  currency,
}: {
  api: Api;
  programId: string;
  currency: string;
}): React.JSX.Element => {
  const reserved = useReservedInvoices();
  return (
    <>
      <Generator api={api} programId={programId} currency={currency} onReserved={reserved.add} />
      <ReleaseGenerator api={api} programId={programId} reserved={reserved} />
    </>
  );
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

  it('should only reserve, never release, while auto release is off', async () => {
    const api = new FakeApi();
    render(<Generators api={api} programId={PROGRAM_A} currency={USD} />);

    await oneRequest();
    await oneRequest();
    await oneRequest();

    expect(api.sent.map(({path}) => path)).toEqual([
      `/programs/${PROGRAM_A}/reservations`,
      `/programs/${PROGRAM_A}/reservations`,
      `/programs/${PROGRAM_A}/reservations`,
    ]);
  });

  it('should send a request every second while running and none after stop', async () => {
    vi.useFakeTimers();
    const api = new FakeApi();
    const {rerender} = render(<Generators api={api} programId={PROGRAM_A} currency={USD} />);

    fireEvent.click(screen.getByRole('button', {name: 'Start'}));
    await act(() => vi.advanceTimersByTimeAsync(1_500));
    rerender(<Generators api={api} programId={PROGRAM_A} currency="EUR" />);
    await act(() => vi.advanceTimersByTimeAsync(1_500));
    const whileRunning = api.sent.length;
    fireEvent.click(screen.getByRole('button', {name: 'Stop'}));
    await act(() => vi.advanceTimersByTimeAsync(3_000));

    expect(whileRunning).toBe(3);
    expect(api.sent).toHaveLength(whileRunning);
  });

  it('should send a request at the interval the slider sets', async () => {
    vi.useFakeTimers();
    const api = new FakeApi();
    render(<Generators api={api} programId={PROGRAM_A} currency={USD} />);

    fireEvent.change(screen.getByLabelText(/Every/), {target: {value: '3'}});
    fireEvent.click(screen.getByRole('button', {name: 'Start'}));
    await act(() => vi.advanceTimersByTimeAsync(6_500));

    expect(api.sent).toHaveLength(2);
  });

  it('should reserve invoice amounts between the minimum and the maximum typed', async () => {
    const reservedWith = async (random: number): Promise<unknown> => {
      const api = new FakeApi();
      render(<Generators api={api} programId={PROGRAM_A} currency={USD} />);
      fireEvent.change(screen.getByLabelText('Minimum amount'), {target: {value: '500'}});
      fireEvent.change(screen.getByLabelText('Maximum amount'), {target: {value: '700'}});
      vi.spyOn(Math, 'random').mockReturnValue(random);
      await oneRequest();
      cleanup();
      return (api.sent[0]?.body as {invoiceAmount: number}).invoiceAmount;
    };

    expect(await reservedWith(0)).toBe(500);
    expect(await reservedWith(0.999)).toBe(700);
  });

  const manual = (): HTMLElement => screen.getByRole('group', {name: 'Release setup'});
  const clickIn = async (inside: HTMLElement, name: string): Promise<void> => {
    await act(async () => {
      fireEvent.click(within(inside).getByRole('button', {name}));
      await Promise.resolve();
    });
  };
  const bodyOf = (sent: Sent | undefined): Record<string, unknown> =>
    sent?.body as Record<string, unknown>;

  it('should release the invoice typed, in part or in full, with a fresh release id each time', async () => {
    const api = new FakeApi();
    render(<Generators api={api} programId={PROGRAM_A} currency={USD} />);
    fireEvent.change(screen.getByLabelText('Invoice'), {target: {value: 'INV-X'}});
    fireEvent.change(within(manual()).getByLabelText(/Amount/), {target: {value: '500'}});
    fireEvent.change(within(manual()).getByLabelText('Reason'), {target: {value: 'cancelled'}});

    await clickIn(document.body, 'One release');
    fireEvent.change(within(manual()).getByLabelText(/Amount/), {target: {value: ''}});
    await clickIn(document.body, 'One release');

    expect(api.sent.map(({path}) => path)).toEqual([
      `/programs/${PROGRAM_A}/reservations/INV-X/releases`,
      `/programs/${PROGRAM_A}/reservations/INV-X/releases`,
    ]);
    expect(bodyOf(api.sent[0])).toMatchObject({amount: 500, reason: 'cancelled'});
    expect(bodyOf(api.sent[1])).not.toHaveProperty('amount');
    expect(bodyOf(api.sent[0]).releaseId).not.toEqual(bodyOf(api.sent[1]).releaseId);
  });

  it('should repeat the last release with the same release id', async () => {
    const api = new FakeApi();
    render(<Generators api={api} programId={PROGRAM_A} currency={USD} />);
    fireEvent.change(screen.getByLabelText('Invoice'), {target: {value: 'INV-X'}});

    await clickIn(document.body, 'One release');
    await clickIn(document.body, 'Repeat last release');

    expect(api.sent).toHaveLength(2);
    expect(bodyOf(api.sent[1])).toEqual(bodyOf(api.sent[0]));
  });

  const auto = (): HTMLElement => screen.getByRole('group', {name: 'Release setup'});
  const reservedIds = (api: FakeApi): string[] =>
    api.sent
      .filter(({path}) => path.endsWith('/reservations'))
      .map(({body}) => (body as {invoiceId: string}).invoiceId);
  const releasedIds = (api: FakeApi): string[] =>
    api.sent
      .filter(({path}) => path.endsWith('/releases'))
      .map(({path}) => path.split('/')[4] ?? '');

  it('should release the oldest reservation in full at the auto release interval, oldest first', async () => {
    vi.useFakeTimers();
    const api = new FakeApi();
    render(<Generators api={api} programId={PROGRAM_A} currency={USD} />);
    await oneRequest();
    await oneRequest();
    fireEvent.change(within(auto()).getByLabelText(/Release every/), {target: {value: '2'}});

    fireEvent.click(screen.getByRole('button', {name: 'Start auto release'}));
    await act(() => vi.advanceTimersByTimeAsync(6_000));

    expect(releasedIds(api)).toEqual(reservedIds(api));
    const releases = api.sent.filter(({path}) => path.endsWith('/releases'));
    expect(releases.every(({body}) => !('amount' in (body as object)))).toBe(true);
  });

  it('should auto release only the invoices of the program shown', async () => {
    vi.useFakeTimers();
    const api = new FakeApi();
    const {rerender} = render(<Generators api={api} programId={PROGRAM_A} currency={USD} />);
    await oneRequest();
    rerender(<Generators api={api} programId={PROGRAM_B} currency={USD} />);

    fireEvent.click(screen.getByRole('button', {name: 'Start auto release'}));
    await act(() => vi.advanceTimersByTimeAsync(3_000));
    const whileOnB = releasedIds(api);
    rerender(<Generators api={api} programId={PROGRAM_A} currency={USD} />);
    await act(() => vi.advanceTimersByTimeAsync(1_000));

    expect(whileOnB).toEqual([]);
    expect(releasedIds(api)).toEqual(reservedIds(api));
  });

  it('should stop auto releasing on Stop', async () => {
    vi.useFakeTimers();
    const api = new FakeApi();
    render(<Generators api={api} programId={PROGRAM_A} currency={USD} />);
    await oneRequest();
    await oneRequest();

    fireEvent.click(screen.getByRole('button', {name: 'Start auto release'}));
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    fireEvent.click(screen.getByRole('button', {name: 'Stop auto release'}));
    await act(() => vi.advanceTimersByTimeAsync(5_000));

    expect(releasedIds(api)).toHaveLength(1);
  });

  it('should keep One release disabled until an invoice is typed beside it', () => {
    render(<Generators api={new FakeApi()} programId={PROGRAM_A} currency={USD} />);
    const oneRelease = screen.getByRole('button', {name: 'One release'});

    const before = (oneRelease as HTMLButtonElement).disabled;
    fireEvent.change(screen.getByLabelText('Invoice'), {target: {value: 'INV-X'}});

    expect(before).toBe(true);
    expect(oneRelease).toBeEnabled();
  });
});
