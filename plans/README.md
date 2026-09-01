# Implementation plans

Generated on 2026-09-01 from the shared project brief. The brief names the project "Intelligent Emergency Vehicle Routing Using Fuzzy Logic and Ant Colony Optimization" but does not define an existing codebase, API, dataset, or UI.

The repository was empty at planning time: it contained only `.git`, had no commits, and had no configured remote. Plan 001 therefore defines a complete, reproducible MVP rather than a patch to existing code.

## Execution order and status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Build ResQRoute in a single Next.js app | P1 | L | - | DONE |
| 002 | Add live map, coordinates, and provider adapters | P1 | M | 001 | DONE |

## Dependency notes

- Plan 001 is self-contained and has been implemented. The API and simple UI depend on the domain model, fuzzy evaluator, and routing service created in the plan.
- Plan 002 is implemented on top of Plan 001. It adds MapLibre rendering, explicit geocoding, real-coordinate route requests, and provider configuration while preserving the fixture graph for reproducible algorithm evaluation.
- Keep the fixture graph and deterministic evaluation harness in place when adding live map or traffic data later. They are the regression baseline for the academic comparison.

## Findings considered and deferred

- Live traffic, GPS tracking, multi-vehicle dispatch, authentication, and production deployment were deferred. The shared brief does not specify a provider, account model, privacy policy, or operational requirements for them. Adding them now would make the result harder to reproduce and would introduce scope that the brief does not justify.
- A real OpenStreetMap or PostGIS graph was deferred. The MVP proves the fuzzy and ACO behavior on a small, versioned graph first; a graph adapter can be added as a separate plan.
