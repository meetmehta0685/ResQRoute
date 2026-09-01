# Plan 001: Build ResQRoute in a single Next.js app

**Status:** DONE
**Planned and implemented:** 2026-09-01
**Priority:** P1
**Effort:** L
**Source brief:** [shared ChatGPT conversation](https://chatgpt.com/s/t_6a964b5b97ec8191a38659779a8517dc)

## Objective

Create a reproducible emergency-vehicle routing prototype named ResQRoute. A dispatcher selects an origin and destination, supplies traffic and urgency values, and receives two explainable routes:

1. A Dijkstra shortest-travel-time baseline.
2. An Ant Colony Optimization (ACO) route using fuzzy-adjusted edge costs.

The first release uses a checked-in synthetic graph so the algorithm can be tested and evaluated without live map, traffic, or GPS credentials. The application is intentionally a single Next.js full-stack project: Route Handlers expose the backend API, while the app page provides a simple functional frontend.

## Product assumptions

- Primary user: student dispatcher/evaluator.
- Product stage: production-oriented prototype.
- One vehicle, one origin, and one destination per calculation.
- Traffic level and urgency are normalized values in `[0, 1]`.
- A numeric seed makes ACO runs reproducible.
- No authentication, database, real-time tracking, multi-vehicle assignment, or external routing provider in this plan.

## Implemented architecture

```text
app/page.tsx
  └── POST /api/routes/optimize
        └── lib/routing/service.ts
              ├── lib/domain/graph.ts
              ├── lib/algorithms/dijkstra.ts
              ├── lib/algorithms/fuzzy.ts
              └── lib/algorithms/aco.ts
```

### Repository layout

```text
.
├── app/
│   ├── api/graph/route.ts
│   ├── api/health/route.ts
│   ├── api/routes/optimize/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── RouteCanvas.tsx
│   └── RouteMetrics.tsx
├── lib/
│   ├── algorithms/{aco,dijkstra,fuzzy}.ts
│   ├── data/graph.ts
│   ├── domain/graph.ts
│   ├── routing/service.ts
│   ├── types.ts
│   └── *.test.ts
├── docs/{algorithm,evaluation}.md
├── scripts/evaluate.ts
├── PRODUCT.md
├── README.md
├── package.json
└── plans/
```

## Domain and algorithm requirements

### Graph

Use a directed graph with stable IDs. Each edge has positive distance and base travel time, plus normalized congestion and risk values. The fixture contains six nodes and two corridors:

| Node | Label | x | y |
|---|---|---:|---:|
| `HOSPITAL` | Hospital | 0.05 | 0.50 |
| `FAST_1` | North junction | 0.30 | 0.75 |
| `FAST_2` | North avenue | 0.65 | 0.75 |
| `SAFE_1` | South junction | 0.30 | 0.25 |
| `SAFE_2` | South avenue | 0.65 | 0.25 |
| `INCIDENT` | Incident | 0.95 | 0.50 |

All graph validation lives in `lib/domain/graph.ts`: duplicate IDs, missing endpoints, invalid ranges, positive-value constraints, adjacency, and route contiguity are rejected there.

The middle fast-corridor edge is intentionally configured with `base_time_s: 100` so the heavy-traffic fixture demonstrates the intended academic trade-off: the baseline remains on the fast corridor, while the fuzzy optimizer can choose the longer but safer corridor.

### Fuzzy evaluator

`lib/algorithms/fuzzy.ts` implements a pure zero-order Sugeno-style evaluator:

- `traffic_input = clamp(edge.congestion * traffic_level, 0, 1)`.
- Triangular/trapezoidal memberships: `low`, `medium`, and `high`.
- Max-min rule firing for traffic, risk, and urgency.
- Singleton consequents: low `0.10`, medium `0.45`, high `0.90`, critical `1.30`.
- Weighted-average defuzzification.
- Named rules `R1_SAFE_LOW_TRAFFIC` through `R7_MEDIUM_TRAFFIC_AND_RISK`.
- Output includes penalty, effective cost, memberships, and dominant rule IDs for explanation.

### Routing

- Dijkstra minimizes the sum of `base_time_s`.
- ACO uses seeded local pseudo-randomness, pheromone evaporation/deposition, no repeated nodes, complete-path-only deposits, and bounded walks.
- Defaults: 30 ants, 80 iterations, alpha `1`, beta `2`, evaporation `0.25`.
- If ACO cannot find a complete route, the service returns the baseline as an explicit fallback rather than a partial path.
- The service returns route sequences, distance, base travel time, fuzzy cost, comparison deltas, rule explanations, and search statistics.

## API contract

### `GET /api/health`

Returns:

```json
{"status":"ok"}
```

### `GET /api/graph`

Returns the versioned fixture graph used by the route canvas.

### `POST /api/routes/optimize`

Request:

```json
{
  "origin_id": "HOSPITAL",
  "destination_id": "INCIDENT",
  "traffic_level": 1.0,
  "urgency": 0.9,
  "seed": 42
}
```

Successful responses contain `baseline`, `optimized`, `comparison`, `explanation`, and `search_stats`. Invalid JSON or fields return a structured 400/422 response; unknown nodes return 404; valid but disconnected requests return a fallback/no-route response as appropriate.

## Frontend scope

The simple client page provides:

- origin and destination selectors;
- traffic and urgency range controls;
- deterministic seed input;
- calculate action with loading and error states;
- an inline SVG graph with both route paths;
- baseline/optimized metrics, route sequences, deltas, fuzzy-rule explanations, and ACO search statistics;
- responsive layout and keyboard-visible focus states.

The UI is deliberately functional and restrained for this phase. Visual expansion can happen after the routing behavior and evaluation are accepted.

## Verification checklist

From the repository root:

```bash
npm install
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm run evaluate
npm audit --omit=dev --audit-level=high
```

The completed implementation currently verifies with:

- 5 test files and 21 passing tests;
- successful TypeScript check, ESLint check, and Next.js production build;
- evaluation route-found rate of 100% (10/10 seeded scenario runs);
- optimized route changes in 5/10 scenario runs;
- zero high-severity production dependency vulnerabilities.

## Deferred follow-up plan

The next implementation should be separate from this reproducible baseline and may add:

1. a real road-graph adapter (OpenStreetMap/OSRM or PostGIS);
2. live traffic ingestion with caching and freshness metadata;
3. authentication and persistent dispatch records;
4. GPS/vehicle state and multi-vehicle assignment;
5. deployment, observability, rate limiting, and operational safety review.

Each addition should preserve the fixture graph and seeded evaluation suite as a regression baseline.
