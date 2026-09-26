import {useState} from 'react';
import {availabilityOf, isRecord} from './api';
import type {Answer, Api} from './api';

const STAMPEDE_SIZE = 25;
// A tenth of what is free, so about ten of the twenty-five fit and the rest must be refused.
const STAMPEDE_SHARE = 10;
const SMALL_AMOUNT = 100;
const OVER_RELEASE = 1_000;

interface ResilienceScenariosProps {
  readonly api: Api;
  readonly programId: string;
  readonly currency: string;
}

/** Held up, did not hold, or could not run at all: a full or missing program is not a failure. */
type Verdict = 'passed' | 'failed' | 'not-run';

interface Outcome {
  readonly verdict: Verdict;
  readonly detail: string;
}

interface Scenario {
  readonly title: string;
  readonly tests: string;
  readonly requestLog: string;
  readonly ledger: string;
  readonly run: (context: Context) => Promise<Outcome>;
}

interface Context {
  readonly api: Api;
  readonly programId: string;
  readonly currency: string;
}

const newInvoiceId = (): string => `INV-${window.crypto.randomUUID().slice(0, 8)}`;
const newReleaseId = (): string => `R-${window.crypto.randomUUID().slice(0, 8)}`;

const codeOf = (answer: Answer): string | null =>
  isRecord(answer.body) && typeof answer.body.code === 'string' ? answer.body.code : null;

/** `3 × 201, 2 × 422`: what api answered, grouped by status. */
const tally = (answers: readonly Answer[]): string => {
  const counts = new Map<number, number>();
  for (const {status} of answers) counts.set(status, (counts.get(status) ?? 0) + 1);
  return [...counts]
    .sort(([a], [b]) => a - b)
    .map(([status, count]) => `${count} × ${status}`)
    .join(', ');
};

const answered = (answers: readonly Answer[]): string =>
  answers.map((answer) => `${answer.status} ${codeOf(answer) ?? ''}`.trim()).join(', ');

const reserve = (context: Context, invoiceId: string, invoiceAmount: number): Promise<Answer> =>
  context.api.send('POST', `/programs/${context.programId}/reservations`, {
    invoiceId,
    invoiceAmount,
    invoiceCurrency: context.currency,
  });

const release = (context: Context, invoiceId: string, body: object): Promise<Answer> =>
  context.api.send(
    'POST',
    `/programs/${context.programId}/reservations/${invoiceId}/releases`,
    body,
  );

const outcome = (passed: boolean, detail: string): Outcome => ({
  verdict: passed ? 'passed' : 'failed',
  detail,
});

const notRun = (detail: string): Outcome => ({verdict: 'not-run', detail});

/** The small reservation a scenario starts from could not be made: say why, not "failed". */
const couldNotReserve = (context: Context, answer: Answer): Outcome =>
  codeOf(answer) === 'CAPACITY_EXCEEDED'
    ? notRun(
        `${context.programId} has no free capacity left for this scenario: Reset, or raise the limit with a New limit.`,
      )
    : outcome(false, `reservation ${answered([answer])}`);

// The five scenarios. Each checks api's answers against what the spec promises (its AC or INV),
// from the outside, the way a client would; the rules themselves live in api.
const SCENARIOS: readonly Scenario[] = [
  {
    title: 'Stampede',
    tests:
      'Twenty-five reservations at the same moment, together far more than the program has free. Capacity must never be exceeded under concurrency (INV-01).',
    requestLog: 'Twenty-five reservation rows: about ten 201, the rest 422 CAPACITY_EXCEEDED.',
    ledger:
      'A reserve row for each 201 only; Reserved stays at or below Limit. Leaves the reservations in place.',
    run: async (context) => {
      const before = availabilityOf((await context.api.read(availabilityPath(context))).body);
      if (before === null) return outcome(false, 'no availability');
      const amount = Math.max(1, Math.ceil(before.available / STAMPEDE_SHARE));
      const answers = await Promise.all(
        Array.from({length: STAMPEDE_SIZE}, () => reserve(context, newInvoiceId(), amount)),
      );
      const after = availabilityOf((await context.api.read(availabilityPath(context))).body);
      if (after === null) return outcome(false, `${tally(answers)} · availability unreadable`);
      const refusedRight = answers.every(
        (answer) => answer.status === 201 || codeOf(answer) === 'CAPACITY_EXCEEDED',
      );
      return outcome(
        refusedRight && after.reserved <= after.limit,
        `${STAMPEDE_SIZE} sent: ${tally(answers)} · Reserved ${after.reserved} of limit ${after.limit}`,
      );
    },
  },
  {
    title: 'Same invoice twice',
    tests:
      'The same invoice reserved twice, as a client retrying would. An invoice is reserved once only (AC-05).',
    requestLog: 'Two reservation rows: 201, then 409 RESERVATION_ALREADY_EXISTS.',
    ledger: 'One reserve row. Leaves the reservation in place.',
    run: async (context) => {
      const invoiceId = newInvoiceId();
      const first = await reserve(context, invoiceId, SMALL_AMOUNT);
      if (first.status !== 201) return couldNotReserve(context, first);
      const second = await reserve(context, invoiceId, SMALL_AMOUNT);
      return outcome(
        first.status === 201 && codeOf(second) === 'RESERVATION_ALREADY_EXISTS',
        `${invoiceId}: ${answered([first, second])}`,
      );
    },
  },
  {
    title: 'Repeated payment',
    tests:
      'One repayment sent twice at the same moment with the same release id. A retry is never a second repayment (AC-16).',
    requestLog:
      'A reservation (201), then two release rows: one 200, one 409 RELEASE_ALREADY_PROCESSED.',
    ledger: 'One reserve row and exactly one release row; the reservation ends closed.',
    run: async (context) => {
      const invoiceId = newInvoiceId();
      const reserved = await reserve(context, invoiceId, SMALL_AMOUNT);
      if (reserved.status !== 201) return couldNotReserve(context, reserved);
      const body = {releaseId: newReleaseId(), reason: 'repaid'};
      const answers = await Promise.all([
        release(context, invoiceId, body),
        release(context, invoiceId, body),
      ]);
      const applied = answers.filter(({status}) => status === 200).length;
      const repeats = answers.filter((answer) => codeOf(answer) === 'RELEASE_ALREADY_PROCESSED');
      return outcome(applied === 1 && repeats.length === 1, `${invoiceId}: ${answered(answers)}`);
    },
  },
  {
    title: 'Paying off more than is left',
    tests:
      'A release larger than the invoice still owes. It is refused whole and changes nothing (AC-13).',
    requestLog: 'A reservation (201), then a release row 422 RELEASE_EXCEEDS_HELD.',
    ledger: 'One reserve row and no release row; the reservation still holds all of it.',
    run: async (context) => {
      const invoiceId = newInvoiceId();
      const reserved = await reserve(context, invoiceId, SMALL_AMOUNT);
      if (reserved.status !== 201) return couldNotReserve(context, reserved);
      const refused = await release(context, invoiceId, {
        releaseId: newReleaseId(),
        amount: OVER_RELEASE,
      });
      const read = await context.api.read(
        `/programs/${context.programId}/reservations/${invoiceId}`,
      );
      const held =
        isRecord(read.body) && typeof read.body.held === 'number' ? read.body.held : null;
      return outcome(
        codeOf(refused) === 'RELEASE_EXCEEDS_HELD' && held === SMALL_AMOUNT,
        `${invoiceId}: ${answered([refused])} · held still ${held ?? 'unknown'}`,
      );
    },
  },
  {
    title: 'Garbage and no token',
    tests:
      'Three malformed reservations (a negative amount, a fraction, an unknown currency) and one without a token. Each is refused with the right code (AC-08, AC-32).',
    requestLog: 'Four reservation rows: three 400 VALIDATION_FAILED, one 401.',
    ledger: 'Nothing: no row is written for a refused request.',
    run: async (context) => {
      const path = `/programs/${context.programId}/reservations`;
      const valid = {
        invoiceId: newInvoiceId(),
        invoiceAmount: SMALL_AMOUNT,
        invoiceCurrency: context.currency,
      };
      const answers = await Promise.all([
        context.api.send('POST', path, {...valid, invoiceAmount: -5}),
        context.api.send('POST', path, {...valid, invoiceAmount: 1.5}),
        context.api.send('POST', path, {...valid, invoiceCurrency: 'ZZZ'}),
        context.api.send('POST', path, valid, {authorize: false}),
      ]);
      const statuses = answers.map(({status}) => status);
      return outcome(statuses.join() === '400,400,400,401', `sent 4: ${answered(answers)}`);
    },
  },
];

const availabilityPath = (context: Context): string =>
  `/programs/${context.programId}/availability`;

/**
 * Stress scenarios run against the program shown (glossary: Demo page). Each says what it tests,
 * what it leaves in the request log and the ledger, and after a run whether api held up. They
 * change the program; Reset in the live ledger starts again from nothing.
 */
export const ResilienceScenarios = ({
  api,
  programId,
  currency,
}: ResilienceScenariosProps): React.JSX.Element => {
  const [outcomes, setOutcomes] = useState<Record<string, Outcome | 'running'>>({});

  const runScenario = async (scenario: Scenario): Promise<void> => {
    setOutcomes((earlier) => ({...earlier, [scenario.title]: 'running'}));
    const context = {api, programId, currency};
    const exists = (await api.read(availabilityPath(context))).status === 200;
    const result = exists
      ? await scenario.run(context)
      : notRun(`${programId} does not exist: send a New limit from the treasury panel first.`);
    setOutcomes((earlier) => ({...earlier, [scenario.title]: result}));
  };

  return (
    <section id="resilience" aria-labelledby="resilience-title">
      <details className="panel" open>
        <summary>
          <h2 id="resilience-title">Resilience scenarios</h2>
        </summary>
        <p className="hint">
          Stress situations the platform is built to survive, run against {programId} through the
          real api. Each says what it tests and what it leaves behind; Reset in the live ledger
          starts again from nothing.
        </p>
        {SCENARIOS.map((scenario) => {
          const result = outcomes[scenario.title];
          return (
            <div key={scenario.title} className="scenario" role="group" aria-label={scenario.title}>
              <h3>{scenario.title}</h3>
              <p className="hint">{scenario.tests}</p>
              <p className="hint">
                <strong>Request log:</strong> {scenario.requestLog}
              </p>
              <p className="hint">
                <strong>Live ledger:</strong> {scenario.ledger}
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="primary"
                  disabled={result === 'running'}
                  onClick={() => void runScenario(scenario)}
                >
                  Run
                </button>
                <span data-testid="outcome" className={outcomeClass(result)}>
                  {describe(result)}
                </span>
              </div>
            </div>
          );
        })}
      </details>
    </section>
  );
};

const VERDICT_LABELS: Readonly<Record<Verdict, string>> = {
  passed: '✓ Held up',
  failed: '✗ Did not hold',
  'not-run': '○ Could not run',
};

const describe = (result: Outcome | 'running' | undefined): string => {
  if (result === undefined) return 'Not run yet.';
  if (result === 'running') return 'Running...';
  return `${VERDICT_LABELS[result.verdict]}: ${result.detail}`;
};

const outcomeClass = (result: Outcome | 'running' | undefined): string => {
  if (result === undefined || result === 'running') return 'hint';
  return `outcome-${result.verdict}`;
};
