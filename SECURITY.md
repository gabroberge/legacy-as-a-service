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

## GitHub repository checklist

This project has no backend and no deploy secrets in-repo, but a **public** repository still needs platform hygiene. Some of this is configured in files here; the rest is **GitHub Settings** (UI or `gh` CLI) — not configurable from git alone.

### Already in this repository

| Control | Location |
| :--- | :--- |
| MIT license | `LICENSE` |
| Security policy | this file |
| Dependency update PRs | `.github/dependabot.yml` |
| CI on every PR | `.github/workflows/ci.yml` |
| Workflows use least-privilege tokens | `permissions:` in workflow files |
| Env / key files ignored | `.gitignore` |

### Already configured (via `scripts/github-setup.sh`)

| Control | Status |
| :--- | :--- |
| Dependabot alerts + security update PRs | ✅ |
| Secret scanning + push protection | ✅ (public repo) |
| Actions: read-only token by default | ✅ |
| Actions: GitHub-owned + explicit allowlist | ✅ `oven-sh/setup-bun`, `EndBug/label-sync` |
| Branch protection on `master` | ✅ CI required, no force push |
| Squash merge only, delete branch on merge | ✅ |
| Discussions / Projects disabled | ✅ |
| LaaS labels synced | ✅ |

### Enable once on GitHub (manual — no reliable API)

**Settings → Actions → General**

- [ ] **Fork pull request workflows** → require approval for outside / first-time contributors  
  *(Principal risque restant sur repo public ; pas d’API fiable pour comptes perso)*

**Settings → Branches → `master` → Edit** (optional lockdown)

- [ ] **Require a pull request before merging** — bloque les push directs sur `master` (dur pour solo ; utile si tu prends des PR externes)
- [ ] **Require conversation resolution** — fil de review résolu avant merge
- [ ] **Include administrators** — même toi ne bypass pas la protection (strict)

**Settings → Code security and analysis**

- [ ] Vérifier visuellement que Dependabot + secret scanning sont ON (normalement déjà fait)

**After push with deploy workflow**

- [ ] **Settings → Pages** → source: GitHub Actions
- [ ] Run **Deploy** workflow if needed

### Optional (usually skip for this repo)

- **CodeQL** — faible valeur (site statique, pas de surface serveur)
- **Disable forking** — impossible sur repo public perso ; seulement org/private
- **Signed commits required** — overkill ici
- **Deploy keys / Actions secrets** — pas nécessaires (Pages via `GITHUB_TOKEN`)

### What this repo does *not* need

- Deploy keys, OAuth apps, or GitHub Actions secrets (Pages uses `GITHUB_TOKEN`)
- Wiki or broad collaborator access

### Private security advisories

Use [GitHub Security Advisories](https://github.com/gabroberge/legacy-as-a-service/security/advisories) for real vulnerabilities. Public issues remain for enterprise theatre.

