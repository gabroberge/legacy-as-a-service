# Security Policy

> **Status:** Migration blocked  
> **Threat model:** Honest retrospectives  
> **Owner:** unknown

## Supported versions

| Version | Supported |
| :--- | :--- |
| `0.0.x` | ✅ Spiritually |
| Anything that unblocks the migration | ❌ Out of scope |

This is a static satirical website. There is no backend, no auth, no database, and no secrets to exfiltrate unless you count tribal knowledge in `content-pool-bulk.ts`.

## Reporting a vulnerability

**Please do not report:**

- Migration blocked (initialization requirement)
- Refactors deferred to Q4
- AI review comments lacking context
- `localStorage` persistence surviving refresh
- Staging parity with production

**Please do report:**

- Actual XSS or injection if you find a real one
- Dependencies with known critical CVEs we should bump
- Anything that would harm visitors beyond the intended existential dread

## How to report

Open a [private security advisory](https://github.com/gabroberge/legacy-as-a-service/security/advisories/new) on GitHub, or email the maintainer if you know who that is (bus factor: 1.2).

Do **not** disclose blocked migration paths in public issues. They are load-bearing.

## Response SLA

| Severity | Response |
| :--- | :--- |
| Critical (real exploit) | Best effort |
| High | Deferred to Q4 |
| Medium | Classified as noise |
| Low | Preserved as convention |

We do not offer a bug bounty. We offer the satisfaction of knowing the billing adapter from 2018 is still receiving traffic on leap days.

## Safe harbor

Good-faith security research is welcome. Earnest attempts to modernize the stack without preserving at least one undocumented convention are not.
