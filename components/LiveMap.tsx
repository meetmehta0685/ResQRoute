"use client";

import { useEffect, useRef, useState } from "react";
import {
  GeolocateControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type GeolocatePositionEvent,
} from "maplibre-gl";
import type { FeatureCollection, LineString } from "geojson";
import { MAP_STYLE } from "../lib/maps/config";
import { routeOverlayOrder, ROUTE_COLORS } from "../lib/maps/route-display";
import type { LiveLocation, RouteComparisonResponse } from "../lib/types";

interface LiveMapProps {
  origin: LiveLocation | null;
  destination: LiveLocation | null;
  response: RouteComparisonResponse | null;
  onUserLocation?: (location: LiveLocation) => void;
}

interface MapLocationMarker {
  location: LiveLocation;
  role: string;
  color: string;
}

function routeFeatures(
  response: RouteComparisonResponse | null,
  algorithm: "baseline" | "optimized",
): FeatureCollection<LineString> {
  const route = response?.[algorithm];
  return {
    type: "FeatureCollection",
    features: route?.geometry
      ? [{
      type: "Feature",
      properties: { routeId: route.edge_ids[0] ?? algorithm },
      geometry: route.geometry,
      }]
      : [],
  } satisfies FeatureCollection<LineString>;
}

function popupForLocation(location: LiveLocation, role: string): Popup {
  return new Popup({ offset: 14, closeButton: false }).setText(
    `${role}: ${location.label}`,
  );
}

function addRouteLayers(map: MapLibreMap) {
  map.addSource("dijkstra-route", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addSource("fuzzy-aco-route", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: "fuzzy-aco-route",
    type: "line",
    source: "fuzzy-aco-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ROUTE_COLORS.optimized,
      "line-width": 7,
      "line-opacity": 0.95,
    },
  });
  map.addLayer({
    id: "dijkstra-route",
    type: "line",
    source: "dijkstra-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ROUTE_COLORS.baseline,
      "line-width": 5,
      "line-opacity": 1,
      "line-dasharray": [1.2, 1.2],
    },
  });
}

function fitMapToLocations(
  map: MapLibreMap,
  origin: LiveLocation | null,
  destination: LiveLocation | null,
  response: RouteComparisonResponse | null,
) {
  const bounds = new LngLatBounds();
  if (origin) bounds.extend([origin.lng, origin.lat]);
  if (destination) bounds.extend([destination.lng, destination.lat]);
  for (const route of [response?.baseline, response?.optimized]) {
    for (const coordinate of route?.geometry?.coordinates ?? []) {
      bounds.extend(coordinate);
    }
  }
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, {
      padding: { top: 92, right: 92, bottom: 92, left: 92 },
      maxZoom: 15,
      duration: 650,
    });
  }
}

function projectRoute(
  map: MapLibreMap,
  coordinates: [number, number][],
): string {
  return coordinates
    .map(([lng, lat]) => {
      const point = map.project([lng, lat]);
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

export function LiveMap({
  origin,
  destination,
  response,
  onUserLocation,
}: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState({ width: 0, height: 0, baseline: "", optimized: "" });

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [77.23, 28.62],
      zoom: 4,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    const geolocate = new GeolocateControl({
      positionOptions: { enableHighAccuracy: true, timeout: 10_000 },
      trackUserLocation: false,
      showAccuracyCircle: true,
    });
    const handleGeolocate = (event: GeolocatePositionEvent) => {
      onUserLocation?.({
        label: "Current location",
        lat: event.coords.latitude,
        lng: event.coords.longitude,
        provider: "Browser geolocation",
      });
    };
    let styleReady = false;
    const handleStyleLoad = () => {
      try {
        if (!map.getSource("dijkstra-route")) addRouteLayers(map);
        styleReady = true;
        setMapReady(true);
        setMapError(null);
      } catch {
        styleReady = true;
        setMapError("The live map style could not be prepared");
      }
    };
    const handleError = (event: { error?: { message?: string } }) => {
      if (!styleReady) {
        setMapError(event.error?.message || "The live map style could not be loaded");
      }
    };

    geolocate.on("geolocate", handleGeolocate);
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(geolocate, "top-right");
    map.on("style.load", handleStyleLoad);
    map.on("load", handleStyleLoad);
    map.on("error", handleError);
    const styleTimeout = window.setTimeout(() => {
      if (!styleReady) setMapError("The live map did not finish loading in time");
    }, 12_000);
    mapRef.current = map;

    return () => {
      geolocate.off("geolocate", handleGeolocate);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.off("style.load", handleStyleLoad);
      map.off("load", handleStyleLoad);
      map.off("error", handleError);
      window.clearTimeout(styleTimeout);
      map.remove();
      mapRef.current = null;
    };
  }, [onUserLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!map.getSource("dijkstra-route")) addRouteLayers(map);
    const baselineSource = map.getSource("dijkstra-route") as GeoJSONSource | undefined;
    const optimizedSource = map.getSource("fuzzy-aco-route") as GeoJSONSource | undefined;
    baselineSource?.setData(routeFeatures(response, "baseline"));
    optimizedSource?.setData(routeFeatures(response, "optimized"));
    map.triggerRepaint();

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    const locationCandidates: (MapLocationMarker | null)[] = [
      origin ? { location: origin, role: "Origin", color: String(ROUTE_COLORS.baseline) } : null,
      destination
        ? { location: destination, role: "Destination", color: String(ROUTE_COLORS.optimized) }
        : null,
    ];
    const locations = locationCandidates.filter(
      (item): item is MapLocationMarker => Boolean(item),
    );
    markersRef.current = locations.map(({ location, role, color }) =>
      new Marker({ color })
        .setLngLat([location.lng, location.lat])
        .setPopup(popupForLocation(location, role))
        .addTo(map),
    );
    fitMapToLocations(map, origin, destination, response);
  }, [destination, mapReady, origin, response]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !mapReady || !container) return;

    const syncOverlay = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      setOverlay({
        width,
        height,
        baseline: response?.baseline.geometry
          ? projectRoute(map, response.baseline.geometry.coordinates)
          : "",
        optimized: response?.optimized.geometry
          ? projectRoute(map, response.optimized.geometry.coordinates)
          : "",
      });
    };

    syncOverlay();
    map.on("move", syncOverlay);
    map.on("resize", syncOverlay);
    map.on("idle", syncOverlay);
    return () => {
      map.off("move", syncOverlay);
      map.off("resize", syncOverlay);
      map.off("idle", syncOverlay);
    };
  }, [mapReady, response]);

  const overlayOrder = routeOverlayOrder(
    response?.baseline.geometry,
    response?.optimized.geometry,
  );

  return (
    <div className="live-map-frame">
      <div className="map-header">
        <div>
          <span className="section-label">Live map</span>
          <strong>{response ? "Dijkstra vs. fuzzy + ACO" : "Choose two places to begin"}</strong>
        </div>
        <span className="map-scale">OSRM geometry / real coordinates</span>
      </div>
      <div className="live-map-stage">
        <div
          ref={containerRef}
          className="live-map-canvas"
          role="application"
          aria-label="Interactive live map showing the selected origin, destination, and driving route"
        />
        {overlay.width > 0 && (
          <svg
            className="map-route-overlay"
            viewBox={`0 0 ${overlay.width} ${overlay.height}`}
            aria-hidden="true"
          >
            {overlayOrder.map((routeLayer) => (
              overlay[routeLayer] && (
                <polyline
                  key={routeLayer}
                  points={overlay[routeLayer]}
                  className={`map-route-overlay-${routeLayer}`}
                />
              )
            ))}
          </svg>
        )}
        {!mapReady && !mapError && (
          <div className="map-status-overlay">Loading live map tiles…</div>
        )}
        {mapError && (
          <div className="map-status-overlay map-status-error" role="alert">
            <strong>Live map unavailable</strong>
            <span>{mapError}. Check the map style URL or network connection.</span>
          </div>
        )}
        <div className="live-map-legend" aria-label="Live map legend">
          <span><i className="legend-pin origin-pin" />Origin</span>
          <span><i className="legend-pin destination-pin" />Destination</span>
          <span><i className="legend-swatch legend-baseline" />Dijkstra · normal</span>
          <span><i className="legend-swatch legend-optimized" />Fuzzy + ACO · emergency</span>
        </div>
      </div>
    </div>
  );
}
