import {apiBaseUrl} from './api';
import type {CallRecord} from './api';
import {CurlBox, curl} from './curl';

export const REQUEST_LOG_SIZE = 50;

export type CallKind = 'reserve' | 'release' | 'treasury' | 'reset' | 'other';

// Which of the page's own calls a row is, for its colour; read from the path the page built.
const KINDS: readonly {readonly kind: CallKind; readonly matches: RegExp}[] = [
  {kind: 'release', matches: /\/reservations\/[^/]+\/releases$/},
  {kind: 'reserve', matches: /\/reservations$/},
  {kind: 'treasury', matches: /^\/dev\/treasury$/},
  {kind: 'reset', matches: /^\/dev\/reset$/},
];

const RELEASED_INVOICE = /\/reservations\/([^/]+)\/releases$/;

/** The invoice a call was about: in the path of a release, in the body of a reservation. */
export const invoiceOf = (path: string, body: unknown): string => {
  const released = RELEASED_INVOICE.exec(path)?.[1];
  if (released !== undefined) return released;
  const isRecord = typeof body === 'object' && body !== null && 'invoiceId' in body;
  return isRecord && typeof body.invoiceId === 'string' ? body.invoiceId : '';
};

export const callKind = (method: string, path: string): CallKind => {
  if (method !== 'POST') return 'other';
  return KINDS.find(({matches}) => matches.test(path))?.kind ?? 'other';
};

const LEGEND: readonly {readonly kind: CallKind; readonly label: string}[] = [
  {kind: 'reserve', label: 'reservation'},
  {kind: 'release', label: 'release'},
  {kind: 'treasury', label: 'treasury message'},
  {kind: 'reset', label: 'reset'},
];

interface RequestLogProps {
  readonly calls: readonly CallRecord[];
  readonly onClear: () => void;
}

export const RequestLog = ({calls, onClear}: RequestLogProps): React.JSX.Element => (
  <section id="request-log" aria-labelledby="request-log-title">
    <h2 id="request-log-title">Request log</h2>
    <p className="hint">
      The last {REQUEST_LOG_SIZE} calls the page made, newest first, as api answered them.
    </p>
    <p className="legend">
      {LEGEND.map(({kind, label}) => (
        <span key={kind} className={`call-${kind}`}>
          {label}
        </span>
      ))}
    </p>
    <div className="actions">
      <button type="button" className="danger" onClick={onClear}>
        Clear
      </button>
      <span className="hint">Empties this table; nothing in api changes.</span>
    </div>
    {calls[0] === undefined ? null : (
      <CurlBox
        baseUrl={apiBaseUrl()}
        commands={[curl(apiBaseUrl(), calls[0].method, calls[0].path, calls[0].body)]}
      />
    )}
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>At</th>
            <th>Method</th>
            <th>Invoice</th>
            <th>Path</th>
            <th>Status</th>
            <th>Code</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => (
            <tr key={call.id} className={`call-${callKind(call.method, call.path)}`}>
              <td>{call.at.slice(11, 19)}</td>
              <td>{call.method}</td>
              <td className="invoice">{invoiceOf(call.path, call.body)}</td>
              <td>{call.path}</td>
              <td>{call.status}</td>
              <td>{call.code}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
