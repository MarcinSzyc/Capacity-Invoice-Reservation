import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import type {Answer, Api} from './api';
import {TreasuryPanel} from './treasury-panel';

const PROGRAM_ID = 'PRG-1';
const USD = 'USD';
const CURRENT_LIMIT = 3_000_000_000;
const PREDEFINED = [
  {invoiceId: 'INV-A', heldAmount: 70_000},
  {invoiceId: 'INV-B', heldAmount: 50_000},
  {invoiceId: 'INV-C', heldAmount: 30_000},
  {invoiceId: 'INV-D', heldAmount: 10_000},
  {invoiceId: 'INV-E', heldAmount: 0},
];

/** The api as the panel sees it: every call recorded, each publish accepted. */
class FakeApi implements Api {
  readonly sent: {path: string; body: unknown}[] = [];

  send(_method: 'GET' | 'POST', path: string, body?: unknown): Promise<Answer> {
    this.sent.push({path, body});
    return Promise.resolve({status: 202, body: {...(body as object), messageId: 'm-1'}});
  }

  read(): Promise<Answer> {
    return Promise.resolve({status: 200, body: null});
  }
}

describe('TreasuryPanel', () => {
  afterEach(() => {
    cleanup();
  });

  const renderPanel = (api: FakeApi): void => {
    render(
      <TreasuryPanel
        api={api}
        programId={PROGRAM_ID}
        currency={USD}
        currentLimit={CURRENT_LIMIT}
      />,
    );
  };
  const box = (name: string): HTMLElement => screen.getByRole('group', {name});
  const setAdded = (name: string, added: boolean): void => {
    const checkbox = within(box(name)).getByRole('checkbox', {name: 'Add to request'});
    if ((checkbox as HTMLInputElement).checked !== added) fireEvent.click(checkbox);
  };
  const typeLimit = (value: string): void => {
    fireEvent.change(within(box('New limit')).getByLabelText('Limit (minor units)'), {
      target: {value},
    });
  };
  const send = async (): Promise<void> => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', {name: 'Send'}));
      await Promise.resolve();
    });
  };
  const sentBody = (api: FakeApi): Record<string, unknown> =>
    api.sent[0]?.body as Record<string, unknown>;

  it('should send a limit update when only the new limit is added', async () => {
    const api = new FakeApi();
    renderPanel(api);

    setAdded('New limit', true);
    setAdded('Invoices', false);
    typeLimit('5000');
    await send();

    expect(sentBody(api)).toMatchObject({type: 'capacity_update', creditLimit: 5000});
  });

  it('should send a snapshot with the current limit when only the invoices are added', async () => {
    const api = new FakeApi();
    renderPanel(api);

    setAdded('New limit', false);
    setAdded('Invoices', true);
    await send();

    expect(sentBody(api)).toMatchObject({
      type: 'reconciliation_snapshot',
      creditLimit: CURRENT_LIMIT,
      activeReservations: PREDEFINED,
    });
  });

  it('should send one snapshot with the new limit when both are added', async () => {
    const api = new FakeApi();
    renderPanel(api);

    setAdded('New limit', true);
    setAdded('Invoices', true);
    typeLimit('7000');
    await send();

    expect(api.sent).toHaveLength(1);
    expect(sentBody(api)).toMatchObject({type: 'reconciliation_snapshot', creditLimit: 7000});
  });

  it('should not send anything while nothing is added', () => {
    renderPanel(new FakeApi());

    setAdded('New limit', false);
    setAdded('Invoices', false);

    expect(screen.getByRole('button', {name: 'Send'})).toBeDisabled();
  });

  it('should send the invoice rows as edited: changed, removed and added', async () => {
    const api = new FakeApi();
    renderPanel(api);
    setAdded('New limit', false);
    setAdded('Invoices', true);

    fireEvent.change(screen.getAllByLabelText('Held')[0] as HTMLElement, {target: {value: '1'}});
    for (let removed = 0; removed < 4; removed += 1) {
      fireEvent.click(screen.getAllByRole('button', {name: 'Remove'})[1] as HTMLElement);
    }
    fireEvent.click(screen.getByRole('button', {name: 'Add invoice'}));
    fireEvent.change(screen.getAllByLabelText('Invoice')[1] as HTMLElement, {
      target: {value: 'INV-X'},
    });
    fireEvent.change(screen.getAllByLabelText('Held')[1] as HTMLElement, {target: {value: '0'}});
    fireEvent.click(screen.getByRole('button', {name: 'Add invoice'}));
    await send();

    expect(sentBody(api).activeReservations).toEqual([
      {invoiceId: 'INV-A', heldAmount: 1},
      {invoiceId: 'INV-X', heldAmount: 0},
    ]);
  });

  it('should send a snapshot with no reservations once every row is removed', async () => {
    const api = new FakeApi();
    renderPanel(api);
    setAdded('New limit', false);
    setAdded('Invoices', true);

    for (let removed = 0; removed < PREDEFINED.length; removed += 1) {
      fireEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0] as HTMLElement);
    }
    await send();

    expect(sentBody(api).activeReservations).toEqual([]);
  });

  it('should show the curl of what Send would send, following the checkboxes', () => {
    renderPanel(new FakeApi());
    const curlText = (): string => within(box('curl')).getByTestId('curl-text').textContent ?? '';

    setAdded('New limit', true);
    setAdded('Invoices', false);
    const update = curlText();
    setAdded('Invoices', true);
    const snapshot = curlText();

    expect(update).toContain('"type":"capacity_update"');
    expect(snapshot).toContain('"type":"reconciliation_snapshot"');
    expect(snapshot).toContain('"invoiceId":"INV-A"');
  });
});
