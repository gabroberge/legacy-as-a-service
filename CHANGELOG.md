# Changelog

All notable changes to this project will be documented in this file, unless they are deferred to Q4.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning is aspirational. Migration is blocked.

## [Unreleased]

### Planned (Q4 FY2027)

- Unblock migration default state
- Complete parallel migration in reality, not slides
- Archive 444 migration blockers
- Assign bus factor above 1.2 for billing
- Formal folder documentation

### Added

- GitHub issue templates, PR template, and SECURITY.md
- CI: build + Vitest suite verifying migration remains blocked
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, sponsor button
- Discover convention / Propose refactor actions in Control Plane

## [0.0.1] — 2026-06-16

### Added

- Landing page (`/`) with pricing, compliance badges, and feature cards
- Control Plane (`/app`) with six tabs
- Dependency map with draggable nodes and load-bearing blocked arrow
- Content pools: an irresponsible amount of curated enterprise copy
- `localStorage` persistence under `laas-control-plane`
- Refactor Deferral Pipeline — all valid end states: Proposed, Discussed, Deferred, Blocked, Forgotten

### Known issues (features)

- Migration blocked by default (initialization requirement)
- Staging parity with production not guaranteed
- 62% of incident classifications are noise (load-bearing)
- Owner: unknown

### Security

- No backend. No auth. No database. No path forward.

---

[Unreleased]: https://github.com/gabroberge/legacy-as-a-service/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/gabroberge/legacy-as-a-service/releases/tag/v0.0.1
