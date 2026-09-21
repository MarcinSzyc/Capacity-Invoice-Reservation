# ADR-0005: Authentication with bearer JWT

- Status: accepted
- Date: proposed 2026-09-19, accepted 2026-09-19
- Slice: S-02
- Related: A-14, A-16, AC-32, AC-33, AC-34, AC-35, AC-37, INV-10

## Context

Every business endpoint needs a bearer JWT whose subject becomes the `clientId` on every
movement (A-14). There is no identity provider in this brief; the service validates tokens
itself and a dev command mints them (AC-37). E2e tests need tokens too, including expired
and wrongly signed ones (AC-33). Health, docs and the demo page are exempt (A-16, INV-10).

## Options

### Option 1: HS256 with a shared secret from configuration
One env variable `JWT_SECRET`; the dev token script and the e2e helper sign with the same
secret; a wrongly signed token is one signed with another secret. Pros: one moving part,
trivially runnable locally. Cons: symmetric, so anyone who can mint can also verify; fine
for service-to-service within one trust boundary, weaker as a public API.

### Option 2: RS256 with a key pair, public key or JWKS URL in configuration
The service holds only the public key; the dev script holds the private key from a file
generated at first start. Pros: mirrors a real identity provider, the service cannot mint.
Cons: key generation in compose, two files to manage, more setup for a reviewer.

### Option 3: Static API keys per client
Pros: simplest possible. Cons: no expiry, no standard claims, does not exercise the token
validation the brief's "authenticated" reasonably implies.

### Guard placement
A global `APP_GUARD` with a `@Public()` decorator for exempt routes is the one-place change
A-14 asks for; per-program scopes later become a claim check inside the same guard.

## Recommendation

Option 1 with the global guard, algorithm pinned to HS256 (`alg` from the token is never
trusted), `exp` required, `sub` required and copied to `request.clientId`, issuer and
audience configured. Library: `jose` (no framework coupling) or `@nestjs/jwt`; either behind a
`TokenVerifier` in `src/common/auth/`. Dev command: `npm run dev:token -- --sub demo-client
--ttl 8h`.

## Decision

Option 1 with the global guard, as recommended. HS256 with a shared secret from configuration
(`JWT_SECRET`), one moving part and nothing to generate before a reviewer can run the service.
Decided by Marcin on 2026-09-19 following the recommendation.

What that fixes for S-02:

- The algorithm is pinned to HS256 in the verifier. The `alg` field of an incoming token is
  never trusted, which is what turns the classic `alg: none` and algorithm confusion attacks
  into an ordinary invalid token.
- `exp` is required and checked, so a token without an expiry is invalid rather than eternal.
  `sub` is required and copied to `request.clientId`, which AC-34 records on every movement.
  Issuer and audience come from configuration and are checked.
- A global `APP_GUARD` with a `@Public()` decorator for the exempt routes: liveness, readiness
  and the documentation views (A-16). This is the one-place change A-14 asks for, and per
  program scopes later become a claim check inside the same guard rather than a second
  mechanism.
- The verifier sits behind a `TokenVerifier` port in `src/common/auth/`, so the library choice
  (`jose` or `@nestjs/jwt`) is not visible to any module.
- The dev command is `npm run dev:token -- --sub demo-client --ttl 8h` (AC-37), signing with
  the same secret the service verifies with.

Considered and declined: RS256 with a key pair (Option 2) is the honest shape for a public API
and the service could then not mint what it verifies, but it puts key generation into compose
and the cold start, which AC-36 and AC-37 close in this same slice; the symmetric secret is
defensible while every caller is inside one trust boundary. Static API keys (Option 3) were
declined because they carry no expiry and no standard claims, so they would not exercise the
token validation the brief implies by "authenticated".

## Consequences

The e2e helper mints tokens in-process with the test secret. Switching to RS256 later changes
the verifier's key source and the dev script, nothing in the modules, which is the reason the
symmetric secret is an acceptable starting point rather than a corner painted into. The demo page in S-07
obtains its token from a dev-only endpoint, so the secret never reaches the browser.
