import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import type {Movement} from './api';
import {Ledger} from './ledger';

const movement = (kind: string, occurredAt: string): Movement => ({
  kind,
  amount: 1,
  limitAfter: 10,
  reservedAfter: 1,
  availableAfter: 9,
  releaseId: null,
  clientId: 'demo-web',
  messageId: null,
  occurredAt,
});

describe('Ledger', () => {
  afterEach(() => {
    cleanup();
  });

  it('should colour each movement by its kind', () => {
    const kinds = ['limit_set', 'reserve', 'release', 'adjustment'];
    render(
      <Ledger
        availability={null}
        movements={kinds.map((kind, index) => movement(kind, `2026-09-26T10:00:0${index}Z`))}
        onReset={() => undefined}
        programId="PRG-1"
      />,
    );

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => row.className)).toEqual(kinds.map((kind) => `movement-${kind}`));
  });
});
