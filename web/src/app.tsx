import {useEffect, useMemo, useState} from 'react';
import {apiBaseUrl, availabilityOf, CallRecord, createApi, movementsOf} from './api';
import type {Availability, Movement} from './api';
import {Generator} from './generator';
import {ReleaseGenerator} from './release-generator';
import {useReservedInvoices} from './reserved-invoices';
import {Ledger} from './ledger';
import {REQUEST_LOG_SIZE, RequestLog} from './request-log';
import {TreasuryPanel} from './treasury-panel';

const POLL_MS = 1_000;
const DEFAULT_PROGRAM_ID = 'PRG-1';
const DEFAULT_CURRENCY = 'USD';

const LINKS = [
  {label: 'Liveness', path: '/health'},
  {label: 'Readiness', path: '/health/ready'},
  {label: 'Swagger UI', path: '/docs'},
  {label: 'Redoc', path: '/redoc'},
  {label: 'OpenAPI document', path: '/openapi.json'},
];

/** The demo page (glossary): four panels over the real api and the real topic (A-17, AC-38). */
export const App = (): React.JSX.Element => {
  const baseUrl = apiBaseUrl();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  // What the request generator reserved, for the release generator to release.
  const reservedInvoices = useReservedInvoices();
  const [programId, setProgramId] = useState(DEFAULT_PROGRAM_ID);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const api = useMemo(
    () =>
      createApi(baseUrl, (call) =>
        setCalls((earlier) => [call, ...earlier].slice(0, REQUEST_LOG_SIZE)),
      ),
    [baseUrl],
  );

  useEffect(() => {
    // An answer for a program id that is no longer shown arrives after this run was cleaned up
    // and is dropped, so a slow poll never paints the previous program over the current one.
    const run = {current: true};
    const poll = async (): Promise<void> => {
      const [program, ledger] = await Promise.all([
        api.read(`/programs/${programId}/availability`),
        api.read(`/dev/programs/${programId}/movements`),
      ]);
      if (!run.current) return;
      setAvailability(program.status === 200 ? availabilityOf(program.body) : null);
      setMovements(ledger.status === 200 ? movementsOf(ledger.body) : []);
    };
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      run.current = false;
      clearInterval(timer);
    };
  }, [api, programId]);

  const currency = availability?.currency ?? DEFAULT_CURRENCY;

  // The whole database goes, so the person confirms first; the log starts again with the reset.
  const reset = async (): Promise<void> => {
    if (!window.confirm('Empty the whole database: every program, reservation and movement?')) {
      return;
    }
    setCalls([]);
    await api.send('POST', '/dev/reset');
  };

  return (
    <main>
      <header>
        <h1>Program Capacity &amp; Invoice Reservation</h1>
        <p>
          A demo over the real api at {baseUrl} and the real treasury topic. Nothing on this page is
          computed here: it shows what api answers.
        </p>
        <nav>
          {LINKS.map(({label, path}) => (
            <a key={path} href={`${baseUrl}${path}`}>
              {label}
            </a>
          ))}
        </nav>
        <div className="program">
          <label>
            Program{' '}
            <input value={programId} onChange={(event) => setProgramId(event.target.value)} />
          </label>
          <p className="notice">
            <span>
              The id every panel works on. A program exists only once the treasury has sent a first
              message for it: send a New limit in the treasury panel before anything else, or every
              call answers <code>PROGRAM_NOT_FOUND</code>.
            </span>
          </p>
        </div>
      </header>
      <Generator
        api={api}
        programId={programId}
        currency={currency}
        onReserved={reservedInvoices.add}
      />
      <ReleaseGenerator api={api} programId={programId} reserved={reservedInvoices} />
      <TreasuryPanel
        api={api}
        programId={programId}
        currency={currency}
        currentLimit={availability?.limit ?? null}
      />
      <Ledger
        availability={availability}
        movements={movements}
        onReset={() => void reset()}
        programId={programId}
      />
      <RequestLog calls={calls} onClear={() => setCalls([])} />
    </main>
  );
};
