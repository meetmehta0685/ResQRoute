"use client";

import { useCallback, useRef, useState } from "react";
import { LiveMap } from "../components/LiveMap";
import { LiveRouteMetrics } from "../components/LiveRouteMetrics";
import { ResQRouteLogo } from "../components/ResQRouteLogo";
import { MAP_ATTRIBUTION } from "../lib/maps/config";
import type {
  GeocodeResponse,
  GeocodeResult,
  LiveLocation,
  RouteComparisonResponse,
} from "../lib/types";

type SearchTarget = "origin" | "destination";

const DEFAULT_CONDITIONS = {
  traffic_level: 0.65,
  urgency: 0.85,
};

const COMPARISON_SEED = 42;

async function readJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "The request failed");
  return payload;
}

interface LocationSearchFieldProps {
  id: string;
  label: string;
  query: string;
  selected: LiveLocation | null;
  results: GeocodeResult[];
  searching: boolean;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (result: GeocodeResult) => void;
}

function LocationSearchField({
  id,
  label,
  query,
  selected,
  results,
  searching,
  onQueryChange,
  onSearch,
  onSelect,
}: LocationSearchFieldProps) {
  return (
    <div className="location-field">
      <label htmlFor={id}>{label}</label>
      <div className="location-search-row">
        <input
          id={id}
          type="search"
          value={query}
          placeholder="Search an address or place"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSearch();
            }
          }}
          aria-describedby={selected ? `${id}-coordinates` : undefined}
        />
        <button
          className="search-button"
          type="button"
          onClick={onSearch}
          disabled={searching}
          aria-label={`Search for ${label.toLowerCase()}`}
        >
          {searching ? "…" : "Find"}
        </button>
      </div>
      {selected && (
        <span id={`${id}-coordinates`} className="coordinate-chip">
          <span className="coordinate-dot" aria-hidden="true" />
          Selected · {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
        </span>
      )}
      {results.length > 0 && (
        <div className="search-results" role="listbox" aria-label={`${label} search results`}>
          {results.map((result) => (
            <button
              key={`${result.provider}-${result.id}`}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => onSelect(result)}
            >
              <strong>{result.label}</strong>
              <span>{result.lat.toFixed(5)}, {result.lng.toFixed(5)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ConditionSlider({
  id,
  label,
  value,
  leftCaption,
  rightCaption,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  leftCaption: string;
  rightCaption: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="condition-field">
      <div className="field-line">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{Math.round(value * 100)}%</output>
      </div>
      <input
        id={id}
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={`${Math.round(value * 100)} percent`}
      />
      <div className="range-caption"><span>{leftCaption}</span><span>{rightCaption}</span></div>
    </div>
  );
}

export default function Home() {
  const [originQuery, setOriginQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [originLocation, setOriginLocation] = useState<LiveLocation | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<LiveLocation | null>(null);
  const [originResults, setOriginResults] = useState<GeocodeResult[]>([]);
  const [destinationResults, setDestinationResults] = useState<GeocodeResult[]>([]);
  const [searchingTarget, setSearchingTarget] = useState<SearchTarget | null>(null);
  const [conditions, setConditions] = useState(DEFAULT_CONDITIONS);
  const [comparison, setComparison] = useState<RouteComparisonResponse | null>(null);
  const [comparing, setComparing] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const geocodeControllers = useRef<Record<SearchTarget, AbortController | null>>({
    origin: null,
    destination: null,
  });

  function clearComparison() {
    setComparison(null);
    setComparisonError(null);
  }

  function updateLocationQuery(target: SearchTarget, value: string) {
    if (target === "origin") {
      setOriginQuery(value);
      setOriginLocation(null);
      setOriginResults([]);
    } else {
      setDestinationQuery(value);
      setDestinationLocation(null);
      setDestinationResults([]);
    }
    clearComparison();
  }

  async function searchLocation(target: SearchTarget) {
    const query = target === "origin" ? originQuery : destinationQuery;
    if (query.trim().length < 3) {
      setComparisonError("Search for at least 3 characters");
      return;
    }
    geocodeControllers.current[target]?.abort();
    const controller = new AbortController();
    geocodeControllers.current[target] = controller;
    setSearchingTarget(target);
    setComparisonError(null);
    try {
      const response = await readJson<GeocodeResponse>(
        `/api/geocode?q=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      );
      if (target === "origin") setOriginResults(response.results);
      else setDestinationResults(response.results);
      if (response.results.length === 0) {
        setComparisonError("No matching places found. Try a more specific search.");
      }
    } catch (reason: unknown) {
      if (!controller.signal.aborted) {
        setComparisonError(
          reason instanceof Error ? reason.message : "Unable to search for that location",
        );
      }
    } finally {
      if (geocodeControllers.current[target] === controller) {
        geocodeControllers.current[target] = null;
        setSearchingTarget(null);
      }
    }
  }

  function selectLocation(target: SearchTarget, result: GeocodeResult) {
    const location: LiveLocation = {
      label: result.label,
      lat: result.lat,
      lng: result.lng,
      place_id: result.id,
      provider: result.provider,
    };
    if (target === "origin") {
      setOriginLocation(location);
      setOriginQuery(result.label);
      setOriginResults([]);
    } else {
      setDestinationLocation(location);
      setDestinationQuery(result.label);
      setDestinationResults([]);
    }
    clearComparison();
  }

  function updateCondition(key: keyof typeof DEFAULT_CONDITIONS, value: number) {
    setConditions((current) => ({ ...current, [key]: value }));
    clearComparison();
  }

  async function handleCompare() {
    if (!originLocation || !destinationLocation) {
      setComparisonError("Search for and select both locations first");
      return;
    }
    if (
      originLocation.lat === destinationLocation.lat &&
      originLocation.lng === destinationLocation.lng
    ) {
      setComparisonError("Choose two different locations");
      return;
    }

    setComparing(true);
    setComparison(null);
    setComparisonError(null);
    try {
      const response = await readJson<RouteComparisonResponse>("/api/routes/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: originLocation,
          destination: destinationLocation,
          ...conditions,
          seed: COMPARISON_SEED,
        }),
      });
      setComparison(response);
    } catch (reason: unknown) {
      setComparisonError(
        reason instanceof Error ? reason.message : "Unable to calculate the route comparison",
      );
    } finally {
      setComparing(false);
    }
  }

  const handleUserLocation = useCallback((location: LiveLocation) => {
    setOriginLocation(location);
    setOriginQuery(`${location.label} (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`);
    setOriginResults([]);
    clearComparison();
  }, []);

  const hasBothLocations = Boolean(originLocation && destinationLocation);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <ResQRouteLogo className="brand-mark" />
          <div><strong>ResQRoute</strong><span>Emergency route intelligence</span></div>
        </div>
        <div className="topbar-status"><span className="status-dot" />Route comparison <span className="status-divider" /> Real coordinates</div>
      </header>

      <section className="intro-row">
        <div>
          <span className="section-label">Dispatch workspace</span>
          <h1>See the route. Explain the decision.</h1>
          <p>Select the starting point and incident location, answer two operating questions, and compare a normal Dijkstra route with a fuzzy + ACO emergency route.</p>
        </div>
        <div className="intro-fact"><span>Route model</span><strong>Dijkstra + fuzzy ACO</strong><small>Live candidate routes, explainable conditions</small></div>
      </section>

      <section className="workspace live-workspace" aria-label="Emergency route planner">
        <aside className="control-panel live-controls">
          <div className="panel-heading"><span className="section-label">Route setup</span><span className="request-id">SELECT LOCATIONS</span></div>
          <form className="route-form" onSubmit={(event) => { event.preventDefault(); void handleCompare(); }}>
            <LocationSearchField
              id="origin-place"
              label="Starting point"
              query={originQuery}
              selected={originLocation}
              results={originResults}
              searching={searchingTarget === "origin"}
              onQueryChange={(value) => updateLocationQuery("origin", value)}
              onSearch={() => void searchLocation("origin")}
              onSelect={(result) => selectLocation("origin", result)}
            />
            <LocationSearchField
              id="destination-place"
              label="Incident location"
              query={destinationQuery}
              selected={destinationLocation}
              results={destinationResults}
              searching={searchingTarget === "destination"}
              onQueryChange={(value) => updateLocationQuery("destination", value)}
              onSearch={() => void searchLocation("destination")}
              onSelect={(result) => selectLocation("destination", result)}
            />

            {hasBothLocations ? (
              <section className="condition-panel" aria-labelledby="condition-heading">
                <div className="condition-heading">
                  <span className="section-label">Operating conditions</span>
                  <span className="condition-ready"><span className="status-dot" />Ready</span>
                </div>
                <h2 id="condition-heading">How should we route this response?</h2>
                <p className="condition-prompt">Tune the conditions before the two route strategies are compared.</p>
                <ConditionSlider
                  id="traffic"
                  label="How heavy is traffic?"
                  value={conditions.traffic_level}
                  leftCaption="Clear"
                  rightCaption="Heavy"
                  onChange={(value) => updateCondition("traffic_level", value)}
                />
                <ConditionSlider
                  id="urgency"
                  label="How urgent is the emergency?"
                  value={conditions.urgency}
                  leftCaption="Routine"
                  rightCaption="Critical"
                  onChange={(value) => updateCondition("urgency", value)}
                />
                <p className="condition-hint"><strong>Demo tip</strong> Set traffic near Heavy to reveal the conditions-aware route change.</p>
              </section>
            ) : (
              <div className="next-step-note" aria-live="polite">
                <span className="next-step-icon" aria-hidden="true" />
                <div><strong>Choose both locations</strong><span>Traffic and emergency questions appear next.</span></div>
              </div>
            )}

            <button className="primary-button live-route-button" type="submit" disabled={comparing || !hasBothLocations}>
              {comparing ? "Comparing routes..." : "Compare two routes"}<span className="button-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path d="M3 8h9M8 4l4 4-4 4" /></svg></span>
            </button>
          </form>
          {comparisonError && <div className="error-box" role="alert"><strong>Comparison not completed</strong><span>{comparisonError}</span></div>}
          <p className="panel-note">The normal route minimizes drive time. Fuzzy logic and ACO weigh the same live candidates against traffic and emergency urgency.</p>
        </aside>

        <div className="map-column"><LiveMap origin={originLocation} destination={destinationLocation} response={comparison} onUserLocation={handleUserLocation} /></div>

        <aside className="results-panel">
          <LiveRouteMetrics response={comparison} trafficLevel={conditions.traffic_level} urgency={conditions.urgency} />
        </aside>
      </section>

      <footer className="footer-note"><span>ResQRoute / Dijkstra + fuzzy ACO comparison</span><span>{MAP_ATTRIBUTION} · routing provider configurable</span></footer>
    </main>
  );
}
