# Contributing to Legacy-as-a-Service™

> **Process owner:** unknown  
> **Last alignment:** Q4 (recurring)  
> **SLA:** best-effort until someone opens a better ticket

Thank you for considering a contribution. This project is absurd by design. Your PR should make that clearer, not accidentally fix it.

---

## Before you open anything

Ask yourself:

1. Does this increase fidelity to real enterprise dysfunction?
2. Would a VP nod solemnly at the changelog entry?
3. Are you about to unblock the migration?

If (3) is yes, stop. The blocked arrow is load-bearing.

---

## Issue classification

All reports are triaged using the official LaaS incident taxonomy:

| Report | Classification | Action |
| :--- | :--- | :--- |
| Migration still blocked after Q4 | **Feature** | Close as working as designed |
| Refactor deferred again | **Feature** | Add to Refactor Deferral Pipeline backlog |
| AI review comment lacks context | **Feature** | Amplify |
| `content-pool-bulk.ts` too large | **Convention** | Preserve. Do not split. |
| Site works on my machine | **Incident** | Investigate staging parity |
| Typo in enterprise copy | **Enhancement** | Welcome if it sounds more corporate |
| README too honest | **Blocked** | Counsel review required |

If your issue does not fit, it will be classified as **noise** (62% load-bearing metric).

---

## Pull requests we want

- New content for the content pools (blockers, incidents, conventions, refactors, AI comments)
- Control plane interactions that defer, block, or ceremonially discuss work without completing it
- Landing copy that could appear on a real vendor site unironically
- Accessibility or UX fixes that do not remove the existential dread
- Typos, unless the typo is `tmp_final_v2_REAL`

## Pull requests we will defer to Q4

- Unblocking the migration arrow
- Replacing `localStorage` with a real backend (introduces scope; violates initialization requirement)
- Refactoring `content-pool-bulk.ts` for "maintainability"
- Adding auth, billing, or a roadmap that ships
- Removing irony on purpose
- "Just cleaning things up" refactors with no product surface

---

## Development (blocked)

```sh
bun install
bun dev       # http://localhost:4321
bun build     # must pass before merge
bun test      # migration must remain blocked (initialization requirement)
```

**Prerequisites:** Node ≥22.12, Bun, tolerance.

### Where to put things

| Change | Location | Notes |
| :--- | :--- | :--- |
| Static enterprise seeds | `src/lib/content-pool-bulk.ts` | Tribal knowledge. Touch gently. |
| Curated / composed content | `src/lib/content-pool.ts` | Prefer bulk for volume |
| State & actions | `src/lib/legacy-state.ts` | Persists to `laas-control-plane` |
| Control plane UI logic | `src/scripts/control-plane.ts` | Tabs, buttons, render |
| Dependency map | `src/scripts/dependency-map.ts` | Migration blocked by default |
| Page shells | `src/pages/` | Landing `/`, app `/app` |

Formal architecture review deferred to Q4 FY2027.

---

## Style guide

### Copy

Write like you have been in the system for nine years and documentation is someone else's Q4.

Good:

> `billing-adapter-2018` still receives traffic on leap days. Owner: unknown.

Bad:

> This module handles billing integration.

### Code

- Match existing patterns. This codebase has conventions; preserve them.
- Minimize scope. A five-line fix that lands the joke beats a hundred-line abstraction.
- No comments explaining obvious things. Comments are for non-obvious business logic, like why the migration is blocked.

### Refactors in the queue

When adding refactor seeds, prefer titles that sound actionable and reasons that explain why they are not.

Statuses may be `Proposed`, `Discussed`, `Deferred`, `Blocked`, or `Forgotten`. All are valid end states.

---

## Review process

1. **Automated checks** — `bun run build` must pass. CI parity with prod not guaranteed.
2. **Human review** — best-effort. Bus factor: 1.2.
3. **AI review** — may generate low-context feedback. Classify as noise unless it catches a real bug.

Approvals are aspirational. Merges happen when alignment is achieved or Q4 ends, whichever comes second.

---

## Commit messages

Complete sentences preferred. Focus on *why* the legacy must be preserved.

Good:

> Add blocker for entitlement mirror cutover deferred to next planning cycle

Acceptable:

> more incidents

Avoid:

> fix migration

---

## Code of conduct

Be kind. Be professional. Do not actually migrate anything.

Harassment, hate speech, and earnest attempts to modernize the stack without preserving at least one undocumented convention are not welcome.

---

## Questions

Open an issue. It will be classified appropriately.

For licensing, see [LICENSE](LICENSE). For the executive version of this document, see [README](README.md).

<p align="center">
  <sub>Thank you for deferring with us.</sub>
</p>
