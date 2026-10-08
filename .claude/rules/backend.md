# Backend Engineering Rules

Open this for API, service, and server-side implementation work.

---

## Architecture

Follow the existing backend separation of concerns.

This is a **Next.js App Router app with no separate backend**, so the generic five-layer stack below is not this repository's shape. The server side is:

```text
proxy.ts + auth.config.ts   — which pages need a session (the `authorized` callback)
app/**/page.tsx             — Server Components; read data by calling app/lib/data.ts
app/lib/actions.ts          — Server Actions ('use server'): validate with zod, write, revalidate, redirect
app/lib/data.ts             — every read query, raw SQL via `postgres` tagged templates
app/**/route.ts             — Route Handlers; only the invoice CSV export (it checks the session itself)
auth.ts                     — NextAuth credentials provider, user lookup, bcrypt compare
```

Reads go in `data.ts`, writes in `actions.ts`, and both talk to SQL directly. Do not add an ORM, a repository or service layer, or an `/api` REST layer for a feature the existing split handles — that is a second solution to a solved problem (`AGENTS.md` §6).

**Server Actions are public HTTP endpoints.** Anything exported from a `'use server'` file can be called with arbitrary arguments by anyone who can reach the site. Validate every argument with zod inside the action (as `createInvoice` does), and check the session with `auth()` inside any action that needs one: `proxy.ts` gates page navigation, not action calls.

`redirect()` throws to do its work. Call it after the `try/catch`, never inside it, as the existing actions do.

The general stack, for orientation only:

```text
transport
   ↓
validation
   ↓
application/service
   ↓
domain
   ↓
persistence/integration
```

Do not move business logic between layers without justification.

---

## Input Validation

Treat all external input as untrusted.

Validate at the appropriate boundary.

Consider:

- type
- format
- range
- length
- required fields
- authorization
- business invariants

Do not rely exclusively on client-side validation.

---

## Authentication

Authentication establishes identity.

Authorization establishes whether that identity may perform an action.

Do not confuse the two.

Every sensitive operation should have an explicit authorization boundary.

---

## Authorization

Verify authorization server-side.

Consider:

- ownership
- roles
- permissions
- tenant boundaries
- administrative privileges
- object-level access

Do not assume that because a user can reach an endpoint they should be allowed to perform the operation.

---

## Errors

Use the project's existing error-handling mechanism.

Errors should:

- be actionable internally
- expose only appropriate information externally
- preserve expected API contracts
- be observable where necessary

Do not leak:

- stack traces
- credentials
- internal secrets
- private data
- unnecessary implementation details

---

## API Contracts

Before changing an API, inspect its consumers.

Consider:

- request shape
- response shape
- status codes
- validation
- error behavior
- idempotency
- retries
- backwards compatibility

---

## Transactions

Where multiple writes must succeed or fail together, use the project's transaction mechanism.

Consider partial failure.

Do not assume sequential operations are automatically atomic.

---

## Concurrency

For operations involving shared state, consider:

- race conditions
- duplicate requests
- retries
- idempotency
- locking
- optimistic concurrency
- stale state

Do not assume requests execute exactly once.

---

## Logging

Logs should help diagnose failures without exposing sensitive information.

Never log:

- passwords
- access tokens
- private keys
- full payment data
- unnecessary personal information

Use structured logging where the repository supports it.

---

## Tests

New backend behavior should have appropriate unit/integration coverage.

Bug fixes should generally include regression coverage.

Test:

- successful behavior
- validation failures
- authorization failures
- important edge cases
- persistence behavior where relevant
- external integration failures where relevant
