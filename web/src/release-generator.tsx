import {useEffect, useRef, useState} from 'react';
import {apiBaseUrl} from './api';
import type {Api} from './api';
import {CurlBox, curl} from './curl';
import type {ReservedInvoices} from './reserved-invoices';

const SECOND_MS = 1_000;
const FASTEST_SECONDS = 1;
const SLOWEST_SECONDS = 10;
const REASONS = ['repaid', 'cancelled'] as const;

interface ReleaseGeneratorProps {
  readonly api: Api;
  readonly programId: string;
  readonly reserved: ReservedInvoices;
}

// Answers after which api holds nothing more to release for that invoice on that program.
const NOTHING_LEFT = new Set([404, 409]);

// A release id must never repeat by chance: a repeat is how a client says "the same repayment".
const newReleaseId = (): string => `R-${window.crypto.randomUUID().slice(0, 8)}`;

const statusOf = (body: unknown): string | null =>
  typeof body === 'object' && body !== null && 'status' in body && typeof body.status === 'string'
    ? body.status
    : null;

const releasePath = (program: string, invoiceId: string): string =>
  `/programs/${program}/reservations/${invoiceId}/releases`;

/**
 * Releases against the real endpoint, only when asked for: on an interval, oldest reservation of
 * the request generator first, or one invoice at a time. Every outcome shown comes from api.
 */
export const ReleaseGenerator = ({
  api,
  programId,
  reserved,
}: ReleaseGeneratorProps): React.JSX.Element => {
  const [releasing, setReleasing] = useState(false);
  const [releaseSeconds, setReleaseSeconds] = useState(FASTEST_SECONDS);
  const [manualInvoice, setManualInvoice] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualReason, setManualReason] = useState<string>(REASONS[0]);
  const [lastRelease, setLastRelease] = useState<{path: string; body: object} | null>(null);

  /** One release as api answers it; a reservation with nothing left is dropped from the list. */
  const sendRelease = async (path: string, invoiceId: string, body: object): Promise<void> => {
    const answer = await api.send('POST', path, body);
    const closed = answer.status === 200 && statusOf(answer.body) === 'closed';
    if (!closed && !NOTHING_LEFT.has(answer.status)) return;
    reserved.remove(invoiceId);
  };

  /** Auto release: the oldest reservation the generator made on this program, in full. */
  const releaseOldest = (): Promise<void> => {
    const oldest = reserved.current().find((held) => held.programId === programId);
    if (oldest === undefined) return Promise.resolve();
    const path = releasePath(oldest.programId, oldest.invoiceId);
    return sendRelease(path, oldest.invoiceId, {releaseId: newReleaseId(), reason: manualReason});
  };

  const releaseManually = (): Promise<void> => {
    const invoiceId = manualInvoice.trim();
    const path = releasePath(programId, invoiceId);
    const body = {
      releaseId: newReleaseId(),
      reason: manualReason,
      ...(manualAmount.trim() === '' ? {} : {amount: Number(manualAmount)}),
    };
    setLastRelease({path, body});
    return sendRelease(path, invoiceId, body);
  };

  const repeatLastRelease = (): Promise<void> => {
    if (lastRelease === null) return Promise.resolve();
    return api.send('POST', lastRelease.path, lastRelease.body).then(() => undefined);
  };

  // What the curl box shows: the release these settings make, with an example id.
  const manualReleaseExample = {
    releaseId: 'R-EXAMPLE',
    reason: manualReason,
    ...(manualAmount.trim() === '' ? {} : {amount: Number(manualAmount)}),
  };
  const manualInvoiceOrExample = manualInvoice.trim() === '' ? 'INV-EXAMPLE' : manualInvoice.trim();

  // The page re-renders on every poll, so the timer reaches the latest release through a ref
  // instead of being restarted by each render, which would keep it from ever firing.
  const latestRelease = useRef(releaseOldest);
  useEffect(() => {
    latestRelease.current = releaseOldest;
  });
  useEffect(() => {
    if (!releasing) return;
    const timer = setInterval(() => void latestRelease.current(), releaseSeconds * SECOND_MS);
    return () => clearInterval(timer);
  }, [releasing, releaseSeconds]);

  return (
    <section id="release-generator" aria-labelledby="release-generator-title">
      <details className="panel" open>
        <summary>
          <h2 id="release-generator-title">Release generator</h2>
        </summary>
        <p className="hint">
          Releases straight to the api over HTTP, as a client reporting a repayment would, only when
          asked for.
        </p>
        <details className="box">
          <summary>
            Release setup
            <span className="summary-note">
              {' '}
              · every {releaseSeconds} s{releasing ? ' · running' : ''}
            </span>
          </summary>
          <div role="group" aria-label="Release setup">
            <p className="hint">
              Releases are sent as a client reporting a repayment would. Start releases the oldest
              open reservation the generator made on this program, in full, one at each interval,
              with the reason below. One release releases the invoice typed beside it, with the
              amount and reason below.
            </p>
            <label>
              Release every {releaseSeconds} s{' '}
              <input
                type="range"
                min={FASTEST_SECONDS}
                max={SLOWEST_SECONDS}
                step={1}
                value={releaseSeconds}
                onChange={(event) => setReleaseSeconds(Number(event.target.value))}
              />
            </label>
            <label>
              Amount (minor units, empty releases all that is left){' '}
              <input
                inputMode="numeric"
                value={manualAmount}
                onChange={(event) => setManualAmount(event.target.value)}
              />
            </label>
            <label>
              Reason{' '}
              <select
                value={manualReason}
                onChange={(event) => setManualReason(event.target.value)}
              >
                {REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
        <div className="actions">
          <button
            type="button"
            className="primary"
            aria-label={releasing ? 'Stop auto release' : 'Start auto release'}
            onClick={() => setReleasing(!releasing)}
          >
            {releasing ? 'Stop' : 'Start'}
          </button>
          <span className="hint">
            Releases the oldest reservation in full every {releaseSeconds} s until stopped.
          </span>
          <button
            type="button"
            className="primary"
            disabled={manualInvoice.trim() === ''}
            onClick={() => void releaseManually()}
          >
            One release
          </button>
          <span className="inline-field">
            <input
              aria-label="Invoice"
              list="reserved-invoices"
              value={manualInvoice}
              placeholder="Invoice, e.g. INV-1a2b3c4d"
              onChange={(event) => setManualInvoice(event.target.value)}
            />
            <datalist id="reserved-invoices">
              {reserved.list
                .filter((held) => held.programId === programId)
                .map((held) => (
                  <option key={held.invoiceId} value={held.invoiceId}>
                    {held.invoiceAmount}
                  </option>
                ))}
            </datalist>
            <span className="hint">Releases this invoice once, with a fresh release id.</span>
          </span>
          <button
            type="button"
            disabled={lastRelease === null}
            onClick={() => void repeatLastRelease()}
          >
            Repeat last release
          </button>
          <span className="hint">
            Sends the same release id again: api answers 409 with the original outcome and changes
            nothing.
          </span>
        </div>
        <CurlBox
          baseUrl={apiBaseUrl()}
          commands={[
            curl(
              apiBaseUrl(),
              'POST',
              `/programs/${programId}/reservations/${manualInvoiceOrExample}/releases`,
              manualReleaseExample,
            ),
          ]}
        />
      </details>
    </section>
  );
};
