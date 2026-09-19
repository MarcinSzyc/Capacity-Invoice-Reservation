# Open questions

Every gap in [[brief]] that needs a decision. Format: question, options, the
recommendation and why. Answered questions move to [[assumptions]] and are marked
`answered: A-xx` here. Questions the user postpones are marked `deferred`.

Status legend: `open`, `answered: A-xx`, `deferred`.

All 28 questions were answered on 2026-09-18 and 2026-09-19. Decisions live in
[[assumptions]]; this page is kept as the record of the options considered.

## Capacity semantics

### Q01 How do programs come into existence? `answered: A-05`
- (a) Only from the treasury via Kafka: a capacity update creates or updates the program, a reconciliation message can also create it.
- (b) Through our own API.
- (c) Both.
- Recommendation: (a). The brief says the treasury owns capacity data. A single write path for program facts avoids two sources of truth. Local development gets a dev-only message producer so a reviewer can create programs without a real treasury.

### Q02 What exactly is available capacity? `answered: A-06`
- (a) limit minus the sum of held amounts of active reservations.
- (b) (a) minus amounts the treasury reports as used outside our service.
- Recommendation: (a), where "active reservations" includes reservations the treasury reports in reconciliation. Anything the treasury knows about arrives as a reservation in the snapshot, so (b) collapses into (a).

### Q03 May the treasury lower the limit below the current reserved amount? `answered: A-06`
- (a) Reject the update.
- (b) Accept, the program becomes overcommitted, available capacity reads zero, new reservations are rejected until releases bring usage under the limit.
- Recommendation: (b). The treasury is authoritative; refusing its data would make our state diverge. Expose limit, reserved and available separately so a client can see overcommitment.

### Q04 Is a reservation equal to the remaining capacity allowed? `answered: A-06`
- Recommendation: yes. Reserve when held amount is less than or equal to available capacity.

## Reservation lifecycle

### Q05 Is an invoice reserved at most once per program? `answered: A-07`
- (a) Yes. A repeated request with the same invoice id and same amount returns the existing reservation (idempotent). Same invoice id with a different amount is a conflict.
- (b) Multiple reservations per invoice allowed.
- Recommendation: (a). Retries are common on the client side; idempotency by invoice id is what a payments API is expected to do.

### Q06 Can a repayment be partial? `answered: A-08`
- (a) Yes. A release reduces the held amount; several releases may follow until it reaches zero. A release larger than the remaining held amount is rejected.
- (b) Release is always the full reservation.
- Recommendation: (a). Invoices are commonly repaid in instalments; (b) is a special case of (a).

### Q07 In which currency is a release expressed? `answered: A-08`
- (a) Invoice currency. The held amount is reduced proportionally using the rate fixed at reservation time.
- (b) Program currency.
- Recommendation: (a). The client knows what was repaid on the invoice; it should not have to know our conversion. The last release rounds to exactly the remaining held amount so nothing is stranded.

### Q08 Release for an unknown reservation, or after it is fully released? `answered: A-09`
- Recommendation: unknown reservation is "not found". Release on a fully released reservation is a conflict. A repeated identical release (same client-supplied release id) is idempotent and returns the earlier result.

### Q09 Is cancelling an approval (invoice not paid after all) distinct from repayment? `answered: A-08`
- (a) Out of scope, a cancellation is a full release.
- (b) Separate operation with its own semantics.
- Recommendation: (a), recorded as an assumption. Keeps the API to the three capabilities the brief names.

### Q10 Do reservations expire? `answered: A-01`
- Recommendation: no. Nothing in the brief suggests it and expiry would need a policy the treasury does not communicate.

## Currencies and conversion

### Q11 In which currency is capacity held? `answered: A-10`
- Recommendation: program currency. A reservation converts the invoice amount to program currency once, at reservation time, stores both amounts and the rate, and the held amount is what counts against the limit. The rate never changes for that reservation, so releases are deterministic.

### Q12 Where do conversion rates come from? `answered: A-02`
- (a) A configured rate table (file or environment), behind a rate-provider seam.
- (b) Rates published by the treasury over Kafka (in the snapshot, or a separate stream).
- (c) An external FX API.
- (d) The client sends the rate in the reservation payload; we book what we receive.
- Decision: (d). Full comparison of all four in [[assumptions]] A-02.

### Q13 Which currencies are supported? `answered: A-10`
- Recommendation: any valid ISO 4217 code is accepted syntactically; a reservation whose pair has no configured rate is rejected as unprocessable. Same-currency reservations need no rate.

### Q14 Rounding of converted amounts? `answered: A-10`
- (a) Round half up to the minor unit of the program currency.
- (b) Round up (ceiling) so capacity is never under-reserved.
- Recommendation: (a). Predictable and standard; the difference is at most one minor unit per reservation. Recorded so a reviewer sees it was chosen, not ignored.

## Kafka and reconciliation

### Q15 Do we define the treasury message contract ourselves? `answered: A-11`
- Recommendation: yes, since none is given. Two message types: a capacity update (program id, currency, new limit, event time, message id) and a reconciliation snapshot (program id, currency, limit, list of active reservations with invoice id and held amount, snapshot moment, message id). Messages keyed by program id.

### Q16 What does a reconciliation snapshot do to local state? `answered: A-12`
- (a) Replace the program's state wholesale.
- (b) Replace limit and currency; replace the set of reservations that existed before the snapshot moment; keep local reservations created after the snapshot moment; record every difference as a reconciliation adjustment in the ledger.
- Recommendation: (b). Wholesale replacement would erase a reservation a client just made and got a success for, which breaks "real time". Snapshots older than the last applied snapshot for that program are ignored.

### Q17 Duplicate and out-of-order messages? `answered: A-13`
- Recommendation: dedupe by message id per program; ignore capacity updates with an event time older than the latest applied fact; rely on partitioning by program id for per-program ordering. Processing the same message twice changes nothing the second time.

### Q18 Malformed or unprocessable messages? `answered: A-13`
- (a) Stop consuming and alert.
- (b) Log with full context, publish to a dead-letter topic, continue with the next message.
- Recommendation: (b). One bad message must not stall capacity updates for every other program on the partition.

### Q19 Do we publish our own events (reservation made, released) to Kafka? `answered: A-03`
- Recommendation: no, out of scope. Noted as the natural next step so the treasury could reconcile against us.

### Q28 How does a release reach us? `answered: A-04`
- (a) Explicit release call from the client when it learns of the repayment; the reconciliation snapshot additionally releases reservations the treasury no longer lists (created before `asOf`), recorded as "released by reconciliation".
- (b) Only through reconciliation snapshots.
- (c) Also from repayment events the treasury publishes on Kafka, so the client never has to call release.
- Recommendation: (a). The brief names "processing releases" as a client-facing capability and demands real time; (b) would lag availability by the reconciliation period. (c) is not suggested by the brief, which speaks of capacity data and reconciliation, not payment events; keep it behind the same use-case seam so it can be added later.

## Authentication and authorisation

### Q20 Authentication mechanism? `answered: A-14`
- (a) Bearer JWT validated by the service against a configured secret or key set, with a dev-only script to mint tokens locally.
- (b) Static API keys per client.
- (c) Full OAuth2 client-credentials flow with an identity provider.
- Recommendation: (a). Standard for service-to-service, carries a client identity for the audit trail, and (c) reduces to (a) at the validation side. Health check exempt (see Q24).

### Q21 Is every authenticated client allowed to act on every program? `answered: A-14`
- (a) Yes for this brief; the client id is recorded on every movement.
- (b) Tokens carry the programs a client may act on.
- Recommendation: (a), recorded as a trade-off, with the check placed so (b) is a one-place change.

## Operations

### Q22 Must state survive a restart? `answered: A-15`
- Recommendation: yes. Production code that forgets reservations on restart is not production code. Storage choice is an ADR in `/plan`.

### Q23 Do we keep a ledger of movements or only current balances? `answered: A-15`
- Recommendation: ledger plus current balance. Reconciliation adjustments and disputes are unexplainable without history, and it is what makes invariants auditable in tests.

### Q24 Are the health endpoint and API documentation authenticated? `answered: A-16`
- Recommendation: liveness and readiness are unauthenticated and return no business data; API documentation is served only outside the production profile. Recorded as an assumption because the brief says "all endpoints".

### Q25 What does "runnable locally" include? `answered: A-17`
- Recommendation: one command starts the service, its database and Kafka; a second dev-only command publishes sample treasury messages so a reviewer can create a program and exercise reservations within a minute of cloning.

### Q26 Observability scope? `answered: A-18`
- Recommendation: structured JSON logs with a correlation id per request and per message, liveness and readiness. Metrics and tracing are noted as follow-ups, not built.

### Q27 What does a client read? `answered: A-19`
- Recommendation: availability of one program (limit, reserved, available, currency, moment of last reconciliation) and a single reservation by id. Listing reservations of a program is included only if cheap; not an acceptance criterion.
