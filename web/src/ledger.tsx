import {apiBaseUrl} from './api';
import type {Availability, Movement} from './api';
import {CurlBox, curl} from './curl';

// The four kinds of ledger row (glossary: Capacity movement), each with its own colour.
const MOVEMENT_KINDS = ['limit_set', 'reserve', 'release', 'adjustment'] as const;

interface LedgerProps {
  readonly availability: Availability | null;
  readonly movements: readonly Movement[];
  readonly onReset: () => void;
  readonly programId: string;
}

/** Amounts are shown as api sends them, integer minor units: the page does no arithmetic. */
export const Ledger = ({
  availability,
  movements,
  onReset,
  programId,
}: LedgerProps): React.JSX.Element => (
  <section id="ledger" aria-labelledby="ledger-title">
    <h2 id="ledger-title">Live ledger</h2>
    <p className="hint">
      The program as api reads it, polled every second. Amounts in minor units, latest movements
      first.
    </p>
    <div className="actions">
      <button type="button" className="danger" onClick={onReset}>
        Reset
      </button>
      <span className="hint">
        Empties the whole database; send a New limit from the treasury panel to create a program
        again.
      </span>
    </div>
    {availability === null ? (
      <p>
        {programId} doesn't exist yet. Programs come only from the treasury: in the treasury panel,
        send a New limit to create it.
      </p>
    ) : (
      <dl className="figures">
        {[
          ['Limit', availability.limit],
          ['Reserved', availability.reserved],
          ['Available', availability.available],
          ['Currency', availability.currency],
          ['Overcommitted', availability.overcommitted ? 'yes' : 'no'],
          ['Last snapshot', availability.asOf ?? 'none'],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    )}
    <CurlBox
      baseUrl={apiBaseUrl()}
      commands={[
        curl(apiBaseUrl(), 'GET', `/programs/${programId}/availability`),
        curl(apiBaseUrl(), 'GET', `/dev/programs/${programId}/movements`),
        curl(apiBaseUrl(), 'POST', '/dev/reset'),
      ]}
    />
    <p className="legend">
      {MOVEMENT_KINDS.map((kind) => (
        <span key={kind} className={`movement-${kind}`}>
          {kind}
        </span>
      ))}
    </p>
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>At</th>
            <th>Kind</th>
            <th>Amount</th>
            <th>Limit after</th>
            <th>Reserved after</th>
            <th>Available after</th>
            <th>By</th>
            <th>Release id</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement, index) => (
            <tr key={`${movement.occurredAt}-${index}`} className={`movement-${movement.kind}`}>
              <td>{movement.occurredAt.slice(11, 19)}</td>
              <td>{movement.kind}</td>
              <td>{movement.amount}</td>
              <td>{movement.limitAfter}</td>
              <td>{movement.reservedAfter}</td>
              <td>{movement.availableAfter}</td>
              <td>{movement.clientId ?? movement.messageId}</td>
              <td>{movement.releaseId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
