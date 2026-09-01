# Live map integration

ResQRoute uses MapLibre GL JS for interactive map rendering and a small server-side provider boundary for place search and driving routes.

## Request flow

```text
Place search -> /api/geocode -> MapTiler (preferred) or Nominatim fallback
Selected coordinates -> /api/routes/live -> OSRM-compatible routing service
Route GeoJSON -> MapLibre source/layers -> markers, alternatives, and fit bounds
```

The browser never calls a geocoder or routing service directly. This keeps API keys out of client code and gives the server one place to add caching, rate limits, telemetry, and provider failover later.

## Local configuration

The no-key local path is:

- an inline MapLibre style using the standard OpenStreetMap raster tiles for the basemap;
- Nominatim for explicit, user-triggered place searches;
- the public OSRM demo endpoint for driving routes.

OpenFreeMap Liberty is also supported by setting `NEXT_PUBLIC_MAP_STYLE_URL`; it is a good no-key vector-style demonstration option. A managed MapTiler or self-hosted style is preferred for a deployed service.

Set these values in `.env.local` for a managed deployment:

```text
NEXT_PUBLIC_MAP_STYLE_URL=https://api.maptiler.com/maps/streets-v2/style.json?key=YOUR_PUBLIC_STYLE_KEY
NEXT_PUBLIC_MAP_ATTRIBUTION=Map data © OpenStreetMap contributors · © MapTiler
MAPTILER_API_KEY=YOUR_SERVER_KEY
GEOCODING_PROVIDER=maptiler
ROUTING_PROVIDER_URL=https://your-osrm-service.example.com
APP_CONTACT_URL=https://your-domain.example.com
```

The public style URL may contain a browser-safe map style key. The geocoding key is server-only. Never commit `.env.local` or place a private provider key in a `NEXT_PUBLIC_` variable.

## Provider constraints

The Nominatim fallback intentionally does not implement type-ahead autocomplete. Searches are sent only when the user presses `Find` or Enter, and the server applies a one-request-per-second guard. Use a managed geocoder or a self-hosted Nominatim instance for more users.

The public OSRM demo endpoint is suitable for demonstration and testing, not a dispatch SLA. A production deployment should point `ROUTING_PROVIDER_URL` at an OSRM-compatible service that is monitored and capacity-managed.

Keep visible attribution for the selected map and data providers. MapLibre is the renderer; it does not supply tiles or geocoding data.

## Scope boundary

The comparison route is built from provider-calculated driving candidates. Dijkstra selects the lowest provider travel time, while the fuzzy + ACO model scores the same candidates using the selected traffic and urgency conditions. This keeps the live geometry honest without claiming that the prototype has a full live road graph, live traffic feed, or operational safety model. Applying ACO to a full live road graph is a later data-engineering phase requiring a graph extract, snapping strategy, traffic model, and operational safeguards.
