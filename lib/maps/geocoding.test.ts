import { afterEach, describe, expect, it, vi } from "vitest";
import { geocode } from "./geocoding";

const originalProvider = process.env.GEOCODING_PROVIDER;
const originalKey = process.env.MAPTILER_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalProvider === undefined) delete process.env.GEOCODING_PROVIDER;
  else process.env.GEOCODING_PROVIDER = originalProvider;
  if (originalKey === undefined) delete process.env.MAPTILER_API_KEY;
  else process.env.MAPTILER_API_KEY = originalKey;
});

describe("geocoding adapter", () => {
  it("normalizes MapTiler place features into coordinate results", async () => {
    process.env.GEOCODING_PROVIDER = "maptiler";
    process.env.MAPTILER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          features: [
            {
              id: "place.1",
              place_name: "India Gate, New Delhi, India",
              place_type: ["poi"],
              geometry: { type: "Point", coordinates: [77.2295, 28.6129] },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await geocode("India Gate");

    expect(response.provider).toBe("MapTiler");
    expect(response.results[0]).toMatchObject({
      id: "place.1",
      label: "India Gate, New Delhi, India",
      lat: 28.6129,
      lng: 77.2295,
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.maptiler.com/geocoding");
  });

  it("rejects ambiguous or empty search input before provider access", async () => {
    await expect(geocode("  ")).rejects.toThrow("at least 3 characters");
  });

  it("does not coerce missing Nominatim coordinates to zero", async () => {
    process.env.GEOCODING_PROVIDER = "nominatim";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { place_id: 1, display_name: "Missing coordinates", lat: null, lon: "" },
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await geocode("missing coordinates");

    expect(response.results).toEqual([]);
  });

  it("ignores MapTiler features with non-point geometry", async () => {
    process.env.GEOCODING_PROVIDER = "maptiler";
    process.env.MAPTILER_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            features: [
              {
                id: "line.1",
                place_name: "Malformed feature",
                geometry: { type: "LineString", coordinates: [77.2, 28.6] },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const response = await geocode("malformed feature");

    expect(response.results).toEqual([]);
  });

  it("reports invalid provider JSON as a geocoding provider error", async () => {
    process.env.GEOCODING_PROVIDER = "nominatim";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not json", { status: 200 })),
    );

    await expect(geocode("invalid provider response")).rejects.toThrow(
      "invalid JSON",
    );
  });
});
