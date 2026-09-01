# Plan 002: Add a live map and provider-backed coordinates

**Status:** DONE
**Implemented:** 2026-09-01
**Depends on:** [Plan 001](./001-build-resqroute-mvp.md)

## Objective

Make the prototype useful for demonstrations with real places while keeping the academic fuzzy/ACO experiment deterministic. Add an interactive MapLibre map, explicit place search, live driving-route geometry, provider configuration, and clear service boundaries.

## Decisions

- MapLibre GL JS is the browser renderer.
- An inline MapLibre style backed by OpenStreetMap raster tiles is the visible no-key local default.
- OpenFreeMap Liberty is supported as a no-key vector-style option through configuration.
- MapTiler is the preferred managed geocoder when `MAPTILER_API_KEY` is configured.
- Nominatim is a throttled, explicit-search fallback for local demonstrations.
- OSRM is the default routing contract; `ROUTING_PROVIDER_URL` can point to a self-hosted or managed OSRM-compatible service.
- Live provider geometry is displayed as live routing. The fuzzy + ACO calculation remains explicitly labeled as the fixture-graph study; it is not falsely presented as optimization over a full road network.

## Delivered work

- Added `maplibre-gl` and its CSS to the Next.js client.
- Added `LiveMap` with real-coordinate markers, route and alternative layers, camera fitting, navigation controls, geolocation control, attribution, and map-load errors.
- Added `LiveRouteMetrics` for provider, location, distance, duration, alternatives, and fetch timestamp.
- Added coordinate and GeoJSON types plus validation helpers.
- Added server-side `/api/geocode` with MapTiler/Nominatim adapters, bounded queries, explicit-search behavior, caching headers, and a Nominatim one-request-per-second guard.
- Added server-side `/api/routes/live` with validated coordinate input and OSRM GeoJSON normalization.
- Added abortable place searches and stale-result clearing in the page.
- Added reachability-aware fixture selectors so the earlier `FAST_1 → SAFE_1` no-route confusion is avoided in the study form.
- Added unit coverage for route normalization, provider parsing, validation, alternatives, and no-route responses.
- Documented environment configuration, attribution, public-service limits, and the live-vs-study scope boundary.

## Acceptance criteria

- The page renders a MapLibre map with real-coordinate markers.
- A user can search and select an origin and destination without provider calls on every keystroke.
- A valid live request returns and displays at least one driving geometry when the configured routing provider has a route.
- Alternative routes are displayed distinctly when the provider returns them.
- Provider failures and no-route responses are shown as actionable errors.
- API keys remain server-side.
- The existing fixture study remains repeatable and its tests continue to pass.

## Production follow-up

OpenFreeMap, public Nominatim, and the public OSRM demo endpoint are useful for demonstrations but should not be treated as a dispatch SLA. A deployed system should use managed or self-hosted tiles, geocoding, and routing with monitoring, caching, rate limits, attribution, privacy review, and a defined data-retention policy.

Applying ACO to a real road graph is a separate engineering phase. It requires extracting and versioning a graph, snapping coordinates to edges, adding a live traffic/risk model, bounding computation, and validating safety behavior before operational use.
