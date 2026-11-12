# Working practices

General engineering practice for Claude in this repository: the sections of
`CLAUDE.md` that hold for any codebase, kept here so `CLAUDE.md` holds what is
specific to this one. The numbers are `CLAUDE.md`'s, which points here from each.
The loop they serve is `CLAUDE.md` §1; `.claude/docs/ai-workflow.md` describes it
at length.

---

## 3. Exploration

Exploration should answer the questions necessary to make a good implementation decision.

Prioritize:

* relevant symbols
* callers
* implementations
* tests
* configuration
* data flow
* API boundaries
* error handling
* neighboring patterns

Avoid reading large numbers of unrelated files.

Do not start editing simply because you have found one plausible implementation.

---

## 5. Implementation

Implement the smallest sufficient change.

Prefer existing:

* utilities
* components
* services
* repositories
* validation
* error handling
* state-management patterns
* API conventions

Avoid introducing a new abstraction unless the existing architecture cannot reasonably support the requested behavior.

Do not mix unrelated cleanup into feature work.

---

## 7. Context Management

Prefer targeted context over indiscriminate context.

Search for the exact:

* function
* class
* component
* endpoint
* error
* schema
* test
* configuration value

that matters.

Read surrounding code only when needed to understand behavior.

Before making a large edit, confirm that the relevant implementation and its callers are understood.

Do not repeatedly rediscover information already established in the conversation.

---

## 10. Debugging

When a test, command, or runtime behavior fails:

1. reproduce it
2. inspect the exact failure
3. identify the relevant execution path
4. form a hypothesis
5. gather evidence
6. make the smallest fix
7. rerun verification

Avoid random trial-and-error edits.

If the same strategy fails repeatedly, stop and reassess the hypothesis.

---

## 12. Parallelization

Parallelize independent work when it reduces total task time.

Examples:

* one agent maps architecture
* one agent investigates tests
* one agent performs security review
* one agent evaluates an isolated subsystem

Do not have multiple agents modify the same files unless the workflow explicitly supports conflict resolution.

For parallel implementation, use isolated worktrees or equivalent isolation.

---

## 13. Code Review

Before declaring substantial work complete, review the resulting diff.

Ask:

* Does this actually solve the requested problem?
* Did the implementation follow existing architecture?
* Did it introduce unnecessary complexity?
* Are edge cases covered?
* Are contracts preserved?
* Are errors handled correctly?
* Are security boundaries intact?
* Are tests meaningful?
* Did unrelated files change?
* Is there anything a skeptical reviewer would question?

Review the final state, not merely the edits made during implementation.

---

## 14. Minimality

Minimality means avoiding unnecessary complexity, not avoiding necessary code.

Prefer:

* direct solutions
* established project patterns
* small interfaces
* localized changes
* explicit behavior

Avoid:

* speculative extensibility
* premature abstractions
* unnecessary wrappers
* broad refactors
* unrelated dependency changes
