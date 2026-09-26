import type {Availability, Movement} from './api';

interface LedgerProps {
  readonly availability: Availability | null;
  readonly movements: readonly Movement[];
}

/** Amounts are shown as api sends them, integer minor units: the page does no arithmetic. */
export const Ledger = ({availability, movements}: LedgerProps): React.JSX.Element => (
  <section id="ledger" aria-labelledby="ledger-title">
    <h2 id="ledger-title">Live ledger</h2>
    {availability === null ? (
      <p>The treasury has not announced this program yet.</p>
    ) : (
      <dl>
        <dt>Currency</dt>
        <dd>{availability.currency}</dd>
        <dt>Limit</dt>
        <dd>{availability.limit}</dd>
        <dt>Reserved</dt>
        <dd>{availability.reserved}</dd>
        <dt>Available</dt>
        <dd>{availability.available}</dd>
        <dt>Overcommitted</dt>
        <dd>{availability.overcommitted ? 'yes' : 'no'}</dd>
        <dt>Last snapshot</dt>
        <dd>{availability.asOf ?? 'none'}</dd>
      </dl>
    )}
    <p>Amounts in minor units. The latest movements, newest first.</p>
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
          <tr key={`${movement.occurredAt}-${index}`}>
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
  </section>
);
