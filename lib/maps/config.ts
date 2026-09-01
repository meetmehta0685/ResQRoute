import type { StyleSpecification } from "maplibre-gl";

export const DEFAULT_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export const MAP_STYLE: string | StyleSpecification =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() || DEFAULT_MAP_STYLE;

export const MAP_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION?.trim() ||
  "Map data © OpenStreetMap contributors · standard demo tiles";
