# ResQRoute

ResQRoute is a Next.js application for comparing emergency vehicle routes on real coordinates. It combines a MapLibre live map and provider-backed driving candidates with Dijkstra, a fuzzy cost evaluator, and a seeded ant colony optimization model.

The live map uses a configurable MapLibre style and server-side geocoding/routing adapters. The comparison model scores the provider's available route candidates using the selected traffic and urgency conditions. This is not a certified navigation or emergency-dispatch system and does not yet use a live traffic feed or ambulance telemetry.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Search for and select a starting point and incident location, answer the two operating questions, and choose `Compare two routes`.

## Verify

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

Run the repeatable evaluation report with:

```bash
npm run evaluate
```

## API

- `GET /api/health` returns the service status.
- `GET /api/graph` returns the fixture nodes and directed edges.
- `POST /api/routes/compare` accepts two live locations plus `traffic_level`, `urgency`, and an optional `seed`, and returns the Dijkstra and fuzzy + ACO comparison with route geometry.
- `POST /api/routes/optimize` accepts `origin_id`, `destination_id`, `traffic_level`, `urgency`, and `seed`.
- `GET /api/geocode?q=...` returns coordinate candidates from MapTiler or the throttled Nominatim fallback.
- `POST /api/routes/live` accepts two `{ label, lat, lng }` locations and returns OSRM GeoJSON route alternatives.

## Map providers

MapLibre GL JS is the renderer; it does not provide map data by itself. The no-key local default is an inline MapLibre style backed by OpenStreetMap raster tiles, so the project shows a real map immediately. For a deployed application, set `NEXT_PUBLIC_MAP_STYLE_URL` to a managed MapTiler/OpenFreeMap style or a self-hosted style and configure a production geocoder/routing provider.

Copy `.env.example` to `.env.local` when you need configuration. `MAPTILER_API_KEY` is server-only and is never sent to the browser. If it is absent, explicit search requests use Nominatim with a one-request-per-second guard for local demonstrations. Do not use the public Nominatim or OpenStreetMap services as an unbounded production backend; use a paid provider or operate your own services at scale.

The live route adapter defaults to the public OSRM demo endpoint. Set `ROUTING_PROVIDER_URL` to an OSRM-compatible deployment for production capacity and reliability. The adapter keeps the provider contract separate from the UI, so a different routing backend can be added without changing the page.

The map visibly includes OpenStreetMap/OpenFreeMap attribution. Keep the attribution and provider-switching behavior when changing styles or tile services.

## Project structure

- `app/` contains the Next.js page and Route Handlers.
- `lib/domain/` contains graph validation and route invariants.
- `lib/algorithms/` contains fuzzy scoring, Dijkstra, and ACO.
- `lib/routing/` coordinates the baseline and optimized results, including the live candidate comparison.
- `components/` contains the route canvas and comparison metrics.
- `components/LiveMap.tsx` contains the client-only MapLibre renderer, markers, route layers, controls, and viewport fitting.
- `lib/maps/` contains coordinate validation, geocoding, map configuration, and live routing provider adapters.
- `scripts/evaluate.ts` runs the fixed scenarios across multiple seeds.
