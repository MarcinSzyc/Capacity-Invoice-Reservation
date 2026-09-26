import {useEffect, useRef, useState} from 'react';
import {apiBaseUrl} from './api';
import type {Api} from './api';
import {CurlBox, curl} from './curl';
import type {Reserved} from './reserved-invoices';

const SECOND_MS = 1_000;
const FASTEST_SECONDS = 1;
const SLOWEST_SECONDS = 10;
const DEFAULT_MINIMUM = 1_000;
const DEFAULT_MAXIMUM = 10_000;

interface GeneratorProps {
  readonly api: Api;
  readonly programId: string;
  readonly currency: string;
  /** Every reservation api accepted, for the release generator to release later. */
  readonly onReserved: (invoice: Reserved) => void;
}

const randomInteger = (from: number, to: number): number =>
  from + Math.floor(Math.random() * (to - from + 1));

/** What the person typed as a whole number of minor units, or the default when it is not one. */
const amountOr = (typed: string, fallback: number): number => {
  const amount = Number(typed);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : fallback;
};

// An invoice id must never repeat by chance: a repeat is refused as already reserved.
const shortId = (): string => window.crypto.randomUUID().slice(0, 8);

/**
 * Random reservations against the real endpoint (A-17). The inputs are random; every outcome
 * shown comes from api, including the refusals. Releases are the release generator's.
 */
export const Generator = ({
  api,
  programId,
  currency,
  onReserved,
}: GeneratorProps): React.JSX.Element => {
  const [running, setRunning] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(FASTEST_SECONDS);
  const [minimum, setMinimum] = useState(String(DEFAULT_MINIMUM));
  const [maximum, setMaximum] = useState(String(DEFAULT_MAXIMUM));
  // Typed the other way round, the range still means the same two ends.
  const randomAmount = (): number => {
    const low = amountOr(minimum, DEFAULT_MINIMUM);
    const high = amountOr(maximum, DEFAULT_MAXIMUM);
    return randomInteger(Math.min(low, high), Math.max(low, high));
  };

  const reserve = async (): Promise<void> => {
    const invoice = {
      programId,
      invoiceId: `INV-${shortId()}`,
      invoiceAmount: randomAmount(),
    };
    const answer = await api.send('POST', `/programs/${programId}/reservations`, {
      invoiceId: invoice.invoiceId,
      invoiceAmount: invoice.invoiceAmount,
      invoiceCurrency: currency,
    });
    if (answer.status !== 201) return;
    onReserved(invoice);
  };

  // What the curl boxes show: the calls these settings make, with an example invoice id.
  const reservationExample = {
    invoiceId: 'INV-EXAMPLE',
    invoiceAmount: amountOr(minimum, DEFAULT_MINIMUM),
    invoiceCurrency: currency,
  };
  // The generator only reserves; releases are the release generator's, and only when asked for.
  const step = (): Promise<void> => reserve();

  // The page re-renders on every poll, so the timer reaches the latest step through a ref
  // instead of being restarted by each render, which would keep it from ever firing.
  const latestStep = useRef(step);
  useEffect(() => {
    latestStep.current = step;
  });
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void latestStep.current(), intervalSeconds * SECOND_MS);
    return () => clearInterval(timer);
  }, [running, intervalSeconds]);

  return (
    <section id="generator" aria-labelledby="generator-title">
      <h2 id="generator-title">Request generator</h2>
      <p className="hint">
        Calls straight to the api over HTTP, the endpoints a client uses: a reservation of a random
        invoice between the minimum and the maximum (minor units). It never releases: that is the
        release generator's job, below.
      </p>
      <details className="box">
        <summary>
          Request setup
          <span className="summary-note">
            {' '}
            · every {intervalSeconds} s · {minimum} to {maximum}
          </span>
        </summary>
        <div role="group" aria-label="Request setup">
          <label>
            Every {intervalSeconds} s{' '}
            <input
              type="range"
              min={FASTEST_SECONDS}
              max={SLOWEST_SECONDS}
              step={1}
              value={intervalSeconds}
              onChange={(event) => setIntervalSeconds(Number(event.target.value))}
            />
          </label>
          <label>
            Minimum amount{' '}
            <input
              inputMode="numeric"
              value={minimum}
              onChange={(event) => setMinimum(event.target.value)}
            />
          </label>
          <label>
            Maximum amount{' '}
            <input
              inputMode="numeric"
              value={maximum}
              onChange={(event) => setMaximum(event.target.value)}
            />
          </label>
        </div>
      </details>
      <div className="actions">
        <button type="button" className="primary" onClick={() => setRunning(!running)}>
          {running ? 'Stop' : 'Start'}
        </button>
        <span className="hint">Sends a request every {intervalSeconds} s until stopped.</span>
        <button type="button" className="primary" onClick={() => void step()}>
          One request
        </button>
        <span className="hint">Sends a single request now.</span>
      </div>
      <CurlBox
        baseUrl={apiBaseUrl()}
        commands={[
          curl(apiBaseUrl(), 'POST', `/programs/${programId}/reservations`, reservationExample),
        ]}
      />
    </section>
  );
};
