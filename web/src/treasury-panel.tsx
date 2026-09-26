import {useState} from 'react';
import {apiBaseUrl, isRecord} from './api';
import {CurlBox, curl} from './curl';
import type {Api} from './api';

// Older than anything the seed or this panel stamps: recorded stale on a program the treasury
// has updated since. On a program id never announced it is the first update and announces it.
const STALE_EVENT_TIME = '2000-01-01T00:00:00.000Z';
const CAPACITY_UPDATE = 'capacity_update';
const SNAPSHOT = 'reconciliation_snapshot';

interface TreasuryPanelProps {
  readonly api: Api;
  readonly programId: string;
  readonly currency: string;
  /** The program's limit as api last reported it, what a snapshot keeps when none is typed. */
  readonly currentLimit: number | null;
}

type Message = Record<string, unknown>;

/** One row of the snapshot table, as typed; `key` only tells React the rows apart. */
interface ListedRow {
  readonly key: number;
  readonly invoiceId: string;
  readonly held: string;
}

// A ready-made treasury view to start from: edit, remove or add to it before sending.
const PREDEFINED: readonly ListedRow[] = [
  {key: 0, invoiceId: 'INV-A', held: '70000'},
  {key: 1, invoiceId: 'INV-B', held: '50000'},
  {key: 2, invoiceId: 'INV-C', held: '30000'},
  {key: 3, invoiceId: 'INV-D', held: '10000'},
  {key: 4, invoiceId: 'INV-E', held: '0'},
];

/** The rows that name an invoice, as the snapshot lists them. api judges the amounts. */
const listed = (rows: readonly ListedRow[]): {invoiceId: string; heldAmount: number}[] =>
  rows
    .filter((row) => row.invoiceId.trim() !== '')
    .map((row) => ({invoiceId: row.invoiceId.trim(), heldAmount: Number(row.held)}));

/**
 * Publishes treasury messages on the real topic through `POST /dev/treasury` (glossary: Dev
 * producer). What the consumer makes of them shows up in the live ledger, or does not.
 */
export const TreasuryPanel = ({
  api,
  programId,
  currency,
  currentLimit,
}: TreasuryPanelProps): React.JSX.Element => {
  const [limit, setLimit] = useState('1000000');
  const [messageCurrency, setMessageCurrency] = useState('');
  const [limitAdded, setLimitAdded] = useState(true);
  const [invoicesAdded, setInvoicesAdded] = useState(false);
  const [rows, setRows] = useState<ListedRow[]>([...PREDEFINED]);
  const [nextKey, setNextKey] = useState(PREDEFINED.length);

  const addRow = (): void => {
    setRows([...rows, {key: nextKey, invoiceId: '', held: ''}]);
    setNextKey(nextKey + 1);
  };
  const changeRow = (key: number, change: Partial<ListedRow>): void =>
    setRows(rows.map((row) => (row.key === key ? {...row, ...change} : row)));
  const removeRow = (key: number): void => setRows(rows.filter((row) => row.key !== key));
  const [last, setLast] = useState<Message | null>(null);

  const publish = async (message: Message): Promise<void> => {
    const answer = await api.send('POST', '/dev/treasury', message);
    if (answer.status === 202 && isRecord(answer.body)) setLast(answer.body);
  };

  const update = (extra: Message = {}): Message => ({
    type: CAPACITY_UPDATE,
    programId,
    currency: messageCurrency === '' ? currency : messageCurrency,
    creditLimit: Number(limit),
    ...extra,
  });

  // A snapshot is the program's whole state, limit included (A-11): with the new limit added it
  // carries that one, without it the limit api reports now, so only the reservations change.
  const snapshot = (): Message => ({
    ...update(),
    type: SNAPSHOT,
    creditLimit: limitAdded ? Number(limit) : currentLimit,
    activeReservations: listed(rows),
  });

  // What the form holds, as one message: invoices make it a snapshot, a limit alone an update.
  const request = (): Message => (invoicesAdded ? snapshot() : update());

  return (
    <section id="treasury" aria-labelledby="treasury-title">
      <details className="panel" open>
        <summary>
          <h2 id="treasury-title">Treasury panel</h2>
        </summary>
        <p className="hint">
          Simulates the treasury. Send calls <code>POST /dev/treasury</code>, and the api publishes
          the message on the Kafka topic <code>treasury.capacity</code>. The api's own consumer is
          subscribed to that topic, so Kafka hands it the message within a moment; the consumer
          validates it, applies it in the database and only then marks it read. The ledger shows the
          result on its next poll.
        </p>
        <details className="box">
          <summary>
            New limit
            {limitAdded ? <span className="summary-note"> · added to request</span> : null}
          </summary>
          <div role="group" aria-label="New limit">
            <p className="notice">
              <span>
                Sent for a program id that does not exist yet, this creates the program. It is the
                only way to create one.
              </span>
            </p>
            <div className="columns">
              <div>
                <label>
                  Limit (minor units){' '}
                  <input value={limit} onChange={(event) => setLimit(event.target.value)} />
                </label>
                <label>
                  Currency{' '}
                  <input
                    value={messageCurrency}
                    placeholder={currency}
                    onChange={(event) => setMessageCurrency(event.target.value)}
                  />
                </label>
              </div>
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={limitAdded}
                    onChange={(event) => setLimitAdded(event.target.checked)}
                  />{' '}
                  Add to request
                </label>
              </div>
            </div>
          </div>
        </details>
        <details className="box">
          <summary>
            Invoices
            {invoicesAdded ? <span className="summary-note"> · added to request</span> : null}
          </summary>
          <div role="group" aria-label="Invoices">
            <label>
              <input
                type="checkbox"
                checked={invoicesAdded}
                onChange={(event) => setInvoicesAdded(event.target.checked)}
              />{' '}
              Add to request
            </label>
            <div className="snapshot">
              <div>
                <table className="snapshot-list">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Held</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.key}>
                        <td>
                          <input
                            aria-label="Invoice"
                            value={row.invoiceId}
                            placeholder="INV-A"
                            onChange={(event) =>
                              changeRow(row.key, {invoiceId: event.target.value})
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label="Held"
                            inputMode="numeric"
                            value={row.held}
                            placeholder="70000"
                            onChange={(event) => changeRow(row.key, {held: event.target.value})}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            aria-label="Remove"
                            onClick={() => removeRow(row.key)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" onClick={addRow}>
                  Add invoice
                </button>
              </div>
              <div>
                <p className="hint">
                  The treasury's view of the program: the reservations it says are active, with what
                  each holds. For example <code>INV-A 70000</code> and <code>INV-B 0</code>: INV-A
                  is set to 70 000, created if new; INV-B, if it exists, is kept holding nothing;
                  every other reservation older than 30 s is released. An empty table says there are
                  none.
                </p>
                <p className="hint">
                  What to expect: the request log shows <code>POST /dev/treasury 202</code> at once,
                  which only means the message is on Kafka. A moment later the consumer processes it
                  and the live ledger shows a <code>limit_set</code> row, then one{' '}
                  <code>adjustment</code> row for each reservation it created, corrected or
                  released, all attributed to the snapshot's message id, with Reserved and Available
                  updated above. A snapshot older than the last one changes nothing.
                </p>
              </div>
            </div>
          </div>
        </details>
        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={!limitAdded && !invoicesAdded}
            onClick={() => void publish(request())}
          >
            Send
          </button>
          <span className="hint">
            Sends one request with what is added: a new limit alone goes as a limit update; invoices
            go as a snapshot, carrying the new limit when it is added too, otherwise the current
            one.
          </span>
          <button type="button" onClick={() => void publish(update({eventTime: STALE_EVENT_TIME}))}>
            Stale
          </button>
          <span className="hint">
            Sends the new limit as an update dated 2000; ignored once a newer limit exists.
          </span>
          <button
            type="button"
            disabled={last === null}
            onClick={() => last && void publish(repeat(last))}
          >
            Duplicate
          </button>
          <span className="hint">
            Resends the last message, update or snapshot; counted as a duplicate, not applied.
          </span>
        </div>
        <CurlBox
          baseUrl={apiBaseUrl()}
          commands={[curl(apiBaseUrl(), 'POST', '/dev/treasury', request())]}
        />
        {last === null ? null : <p>Last published: {String(last.messageId)}</p>}
      </details>
    </section>
  );
};

/** The last message again, same `messageId` and same time: the consumer's duplicate. */
const repeat = (published: Message): Message => {
  const {eventTime, asOf, ...rest} = published;
  if (published.type === SNAPSHOT) return {...rest, asOf};
  return {...rest, eventTime};
};
