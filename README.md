# Legacy-as-a-Service™

> **Status:** Migration blocked  
> **Next review:** Q4 (recurring)  
> **Bus factor:** 1.2  
> **This repository is absurd by design.** That is the initialization requirement.

**Live demo:** https://gabroberge.github.io/legacy-as-a-service/ (staging parity not guaranteed)

---

## Executive summary

Legacy-as-a-Service (LaaS) is the industry-leading platform for **not** modernizing your stack. We help organizations preserve `tmp_final_v2_REAL`, defer refactors with confidence, and schedule migration theatre at enterprise scale.

This repo is a static website that looks like a control plane. It is not a control plane. It is a mirror held up to every planning cycle you have ever survived.

There is no backend. No auth. No database. No path forward.  
There is Astro, Tailwind, TypeScript, an irresponsible amount of curated enterprise copy, and `localStorage`.

If that bothers you, please open a ticket. It will be classified as noise.

---

## Product surface

| Route | SKU | Description |
| :--- | :--- | :--- |
| `/` | `LaaS-LAND-001` | Landing. Pricing. Compliance badges. Aspirational migration dates. |
| `/app` | `LaaS-CP-FULL` | Control Plane. Six tabs. One blocked migration. Infinite incidents. |

### Included modules (all live in production of your imagination)

- **Convention Preservation Engine** — discovers naming patterns and locks them before anyone can document them
- **Refactor Deferral Pipeline** — proposes refactors pre-blocked for your convenience
- **AI Review Noise Amplifier** — generates low-context comments at scale; PRs remain in draft
- **Dependency Map** — draggable nodes; arrows; migration blocked toast (working as designed)
- **Incident Log** — timestamps in `HH:MM:SS` because severity is a lifestyle

State persists under `laas-control-plane` in `localStorage`. Survives refresh. Does not survive honest retrospectives.

---

## Getting started (blocked)

```sh
bun install          # dependencies resolve; architecture does not
bun dev              # http://localhost:4321 — staging parity not guaranteed
bun build            # emits static HTML; legacy emits itself
bun preview          # preview the build; preview the regret
```

**Prerequisites:** Node ≥22.12, Bun, and organizational tolerance for systems that outlive their owners.

---

## Architecture

```
[ Landing ] ----aspirational----> [ Control Plane ]
       |                                  |
       v                                  v
  content-pool.ts              legacy-state.ts (localStorage)
       |                                  |
       +--------> content-pool-bulk.ts <--+
                  (do not refactor)
```

- `content-pool-bulk.ts` — tribal knowledge. Owner unknown. Last meaningful edit: disputed.
- `dependency-map.ts` — migration target exists. Migration does not.
- `legacy-state.ts` — single source of truth until someone clears site data.

Formal folder documentation deferred to Q4 FY2027. Alignment scheduled quarterly since 2021.

---

## Compliance

- ✅ SOC 2 Type II (self-attested, spiritually)
- ✅ GDPR export available via intern script (blessed by counsel)
- ✅ Migration blocked by default (initialization requirement)
- ✅ 62% of incident classifications are noise (load-bearing)

---

## Contributing

PRs welcome if they increase fidelity to real enterprise dysfunction. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full deferral pipeline. [Code of Conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md)

| Report | Classification |
| :--- | :--- |
| Migration still blocked after Q4 | **Feature** |
| Refactor deferred again | **Feature** |
| AI review comment lacks context | **Feature** |
| `content-pool-bulk.ts` too large | **Convention** — preserve it |
| Site works on my machine | **Incident** — investigate staging parity |

Please do not fix the migration. The blocked arrow is load-bearing.

---

## License

[MIT](LICENSE) — fork, remix, and defer freely. Legally unambiguous, unlike the billing adapter from 2018.

Celebrate the tenth birthday with sunset, not cake.

---

<p align="center">
  <sub>Legacy-as-a-Service™ — Because the best time to migrate was Q4. The second best time is also Q4.</sub>
</p>
