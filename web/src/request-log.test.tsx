import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {callKind, RequestLog} from './request-log';

const AT = '2026-09-26T10:00:00.000Z';

describe('RequestLog', () => {
  afterEach(() => {
    cleanup();
  });

  it('should tell the kinds of request apart by method and path', () => {
    expect(callKind('POST', '/programs/PRG-1/reservations')).toBe('reserve');
    expect(callKind('POST', '/programs/PRG-1/reservations/INV-A/releases')).toBe('release');
    expect(callKind('POST', '/dev/treasury')).toBe('treasury');
    expect(callKind('POST', '/dev/reset')).toBe('reset');
    expect(callKind('GET', '/programs/PRG-1/availability')).toBe('other');
  });

  it('should colour each row by the kind of request it was', () => {
    render(
      <RequestLog
        calls={[
          {id: 1, at: AT, method: 'POST', path: '/dev/treasury', status: 202, code: null},
          {
            id: 2,
            at: AT,
            method: 'POST',
            path: '/programs/P/reservations',
            status: 201,
            code: null,
          },
        ]}
        onClear={() => undefined}
      />,
    );

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => row.className)).toEqual(['call-treasury', 'call-reserve']);
  });

  it('should show the invoice of a reservation from its body and of a release from its path', () => {
    render(
      <RequestLog
        calls={[
          {
            id: 1,
            at: AT,
            method: 'POST',
            path: '/programs/P/reservations/INV-rel/releases',
            status: 200,
            code: null,
            body: {releaseId: 'R-1'},
          },
          {
            id: 2,
            at: AT,
            method: 'POST',
            path: '/programs/P/reservations',
            status: 201,
            code: null,
            body: {invoiceId: 'INV-new', invoiceAmount: 1},
          },
          {id: 3, at: AT, method: 'POST', path: '/dev/treasury', status: 202, code: null},
        ]}
        onClear={() => undefined}
      />,
    );

    const invoices = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('td.invoice')?.textContent);
    expect(invoices).toEqual(['INV-rel', 'INV-new', '']);
  });
});
