import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {CurlBox, curl, TOKEN_LINE} from './curl';

const BASE_URL = 'http://localhost:3000';

describe('curl', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('should write a call with its token and JSON body as one command', () => {
    const command = curl(BASE_URL, 'POST', '/programs/PRG-1/reservations', {
      invoiceId: 'INV-A',
      invoiceAmount: 120,
    });

    expect(command).toBe(
      [
        `curl -s -X POST '${BASE_URL}/programs/PRG-1/reservations' \\`,
        `  -H "Authorization: Bearer $TOKEN" \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -d '{"invoiceId":"INV-A","invoiceAmount":120}'`,
      ].join('\n'),
    );
  });

  it('should leave the token out of a dev call and escape a quote in the body', () => {
    const command = curl(BASE_URL, 'POST', '/dev/treasury', {programId: "O'Brien"});

    expect(command).not.toContain('Authorization');
    expect(command).toContain(`-d '{"programId":"O'\\''Brien"}'`);
  });

  it('should copy the whole snippet, the token line first, in one click', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', {clipboard: {writeText}});
    render(<CurlBox baseUrl={BASE_URL} commands={['curl -X GET x']} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', {name: 'Copy'}));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(`${TOKEN_LINE(BASE_URL)}\n\ncurl -X GET x`);
    expect(screen.getByRole('button', {name: 'Copied'})).toBeInTheDocument();
  });
});
