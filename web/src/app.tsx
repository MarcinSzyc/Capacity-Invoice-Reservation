import {useEffect, useMemo, useState} from 'react';
import {apiBaseUrl, CallRecord, createApi} from './api';
import {Generator} from './generator';
import {Availability, Ledger, Movement} from './ledger';
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

const movementsOf = (body: unknown): Movement[] =>
  typeof body === 'object' && body !== null && 'movements' in body && Array.isArray(body.movements)
    ? (body.movements as Movement[])
    : [];

/** The demo page (glossary): four panels over the real api and the real topic (A-17, AC-38). */
export const App = (): React.JSX.Element => {
  const baseUrl = apiBaseUrl();
  const [calls, setCalls] = useState<CallRecord[]>([]);
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
    const poll = async (): Promise<void> => {
      const [program, ledger] = await Promise.all([
        api.read(`/programs/${programId}/availability`),
        api.read(`/dev/programs/${programId}/movements`),
      ]);
      setAvailability(program.status === 200 ? (program.body as Availability) : null);
      setMovements(ledger.status === 200 ? movementsOf(ledger.body) : []);
    };
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  }, [api, programId]);

  const currency = availability?.currency ?? DEFAULT_CURRENCY;

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
        <label>
          Program <input value={programId} onChange={(event) => setProgramId(event.target.value)} />
        </label>
      </header>
      <Generator api={api} programId={programId} currency={currency} />
      <TreasuryPanel api={api} programId={programId} currency={currency} />
      <Ledger availability={availability} movements={movements} />
      <RequestLog calls={calls} />
    </main>
  );
};
