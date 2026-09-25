import {useState} from 'react';
import type {Api} from './api';

// Older than anything the seed or this panel stamps, so the consumer records it as stale.
const STALE_EVENT_TIME = '2000-01-01T00:00:00.000Z';
const CAPACITY_UPDATE = 'capacity_update';
const SNAPSHOT = 'reconciliation_snapshot';

interface TreasuryPanelProps {
  readonly api: Api;
  readonly programId: string;
  readonly currency: string;
}

type Message = Record<string, unknown>;

/** `INV-A:70000000,INV-B:0`, the `dev:treasury` form, split into the entries it names. */
const listed = (text: string): {invoiceId: string; heldAmount: number}[] =>
  text
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .map((entry) => {
      const [invoiceId = '', heldAmount = ''] = entry.split(':');
      return {invoiceId: invoiceId.trim(), heldAmount: Number(heldAmount)};
    });

/**
 * Publishes treasury messages on the real topic through `POST /dev/treasury` (glossary: Dev
 * producer). What the consumer makes of them shows up in the live ledger, or does not.
 */
export const TreasuryPanel = ({
  api,
  programId,
  currency,
}: TreasuryPanelProps): React.JSX.Element => {
  const [limit, setLimit] = useState('1000000000');
  const [messageCurrency, setMessageCurrency] = useState('');
  const [reservations, setReservations] = useState('');
  const [last, setLast] = useState<Message | null>(null);

  const publish = async (message: Message): Promise<void> => {
    const answer = await api.send('POST', '/dev/treasury', message);
    if (answer.status === 202 && typeof answer.body === 'object' && answer.body !== null) {
      setLast(answer.body as Message);
    }
  };

  const common = (): Message => ({
    programId,
    currency: messageCurrency === '' ? currency : messageCurrency,
    creditLimit: Number(limit),
  });

  return (
    <section id="treasury" aria-labelledby="treasury-title">
      <h2 id="treasury-title">Treasury panel</h2>
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
      <label>
        Snapshot reservations{' '}
        <input
          value={reservations}
          placeholder="INV-A:70000000,INV-B:0"
          onChange={(event) => setReservations(event.target.value)}
        />
      </label>
      <div>
        <button type="button" onClick={() => void publish({type: CAPACITY_UPDATE, ...common()})}>
          Limit change
        </button>{' '}
        <button
          type="button"
          onClick={() =>
            void publish({type: SNAPSHOT, ...common(), activeReservations: listed(reservations)})
          }
        >
          Snapshot
        </button>{' '}
        <button
          type="button"
          disabled={last === null}
          onClick={() => last && void publish(repeat(last))}
        >
          Duplicate
        </button>{' '}
        <button
          type="button"
          onClick={() =>
            void publish({type: CAPACITY_UPDATE, ...common(), eventTime: STALE_EVENT_TIME})
          }
        >
          Stale
        </button>
      </div>
      {last === null ? null : <p>Last published: {String(last.messageId)}</p>}
    </section>
  );
};

/** The last message again, same `messageId` and same time: the consumer's duplicate. */
const repeat = (published: Message): Message => {
  const {eventTime, asOf, ...rest} = published;
  if (published.type === SNAPSHOT) return {...rest, asOf};
  return {...rest, eventTime};
};
