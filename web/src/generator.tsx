import {useEffect, useRef, useState} from 'react';
import type {Api} from './api';

const TICK_MS = 1_000;
const LARGEST_AMOUNT = 100_000;

interface GeneratorProps {
  readonly api: Api;
  readonly programId: string;
  readonly currency: string;
}

interface Reserved {
  readonly invoiceId: string;
  readonly invoiceAmount: number;
}

const randomInteger = (from: number, to: number): number =>
  from + Math.floor(Math.random() * (to - from + 1));

const randomSuffix = (): string => Math.random().toString(36).slice(2, 10);

const statusOf = (body: unknown): string | null =>
  typeof body === 'object' && body !== null && 'status' in body && typeof body.status === 'string'
    ? body.status
    : null;

/**
 * Random reserve and release calls against the real endpoints (A-17). The inputs are random;
 * every outcome shown comes from api, including the refusals.
 */
export const Generator = ({api, programId, currency}: GeneratorProps): React.JSX.Element => {
  const [running, setRunning] = useState(false);
  const reserved = useRef<Reserved[]>([]);

  const reserve = async (): Promise<void> => {
    const invoice = {
      invoiceId: `INV-${randomSuffix()}`,
      invoiceAmount: randomInteger(1, LARGEST_AMOUNT),
    };
    const answer = await api.send('POST', `/programs/${programId}/reservations`, {
      ...invoice,
      invoiceCurrency: currency,
    });
    if (answer.status === 201) reserved.current.push(invoice);
  };

  const release = async (invoice: Reserved): Promise<void> => {
    const inFull = Math.random() < 0.5;
    const answer = await api.send(
      'POST',
      `/programs/${programId}/reservations/${invoice.invoiceId}/releases`,
      {
        releaseId: `R-${randomSuffix()}`,
        ...(inFull ? {} : {amount: randomInteger(1, invoice.invoiceAmount)}),
      },
    );
    if (answer.status !== 200 && answer.status !== 409) return;
    if (answer.status === 409 || statusOf(answer.body) === 'closed') {
      reserved.current = reserved.current.filter((held) => held !== invoice);
    }
  };

  const step = (): Promise<void> => {
    const candidates = reserved.current;
    const invoice = candidates[randomInteger(0, candidates.length - 1)];
    if (invoice === undefined || Math.random() < 0.5) return reserve();
    return release(invoice);
  };

  // The page re-renders on every poll, so the timer reaches the latest step through a ref
  // instead of being restarted by each render, which would keep it from ever firing.
  const latestStep = useRef(step);
  useEffect(() => {
    latestStep.current = step;
  });
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void latestStep.current(), TICK_MS);
    return () => clearInterval(timer);
  }, [running]);

  return (
    <section id="generator" aria-labelledby="generator-title">
      <h2 id="generator-title">Request generator</h2>
      <p>
        Once a second while running: a reservation of a random invoice of up to {LARGEST_AMOUNT}{' '}
        minor units, or a release of one reserved earlier, in full or in part.
      </p>
      <button type="button" onClick={() => setRunning(!running)}>
        {running ? 'Stop' : 'Start'}
      </button>{' '}
      <button type="button" onClick={() => void step()}>
        One request
      </button>
    </section>
  );
};
