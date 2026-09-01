import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseLiveRouteInput,
  routeLiveLocations,
} from "./routing";

const origin = {
  label: "Origin",
  lat: 28.6129,
  lng: 77.2295,
};
const destination = {
  label: "Destination",
  lat: 28.6315,
  lng: 77.2167,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("live routing adapter", () => {
  it("validates locations before calling the provider", () => {
    expect(() =>
      parseLiveRouteInput({
        origin,
        destination: { ...destination, lat: 120 },
      }),
    ).toThrow("destination must contain valid coordinates");
  });

  it("normalizes OSRM GeoJSON routes into the app contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "Ok",
          routes: [
            {
              distance: 2_800,
              duration: 180,
              geometry: {
                type: "LineString",
                coordinates: [
                  [origin.lng, origin.lat],
                  [77.22, 28.62],
                  [destination.lng, destination.lat],
                ],
              },
            },
            {
              distance: 3_100,
              duration: 240,
              geometry: {
                type: "LineString",
                coordinates: [
                  [origin.lng, origin.lat],
                  [destination.lng, destination.lat],
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await routeLiveLocations(origin, destination);

    expect(response.provider).toBe("OSRM");
    expect(response.routes).toHaveLength(2);
    expect(response.routes[0].is_alternative).toBe(false);
    expect(response.routes[1].is_alternative).toBe(true);
    expect(response.routes[0].geometry.coordinates).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toContain("geometries=geojson");
  });

  it("adds a distinct detour candidate when the provider returns only one route", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "Ok",
            routes: [{
              distance: 8_900,
              duration: 540,
              geometry: {
                type: "LineString",
                coordinates: [
                  [origin.lng, origin.lat],
                  [destination.lng, destination.lat],
                ],
              },
            }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "Ok",
            routes: [{
              distance: 10_100,
              duration: 690,
              geometry: {
                type: "LineString",
                coordinates: [
                  [origin.lng, origin.lat],
                  [77.24, 28.62],
                  [destination.lng, destination.lat],
                ],
              },
            }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "Ok",
            routes: [{
              distance: 9_700,
              duration: 600,
              geometry: {
                type: "LineString",
                coordinates: [
                  [origin.lng, origin.lat],
                  [77.21, 28.63],
                  [destination.lng, destination.lat],
                ],
              },
            }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await routeLiveLocations(origin, destination);

    expect(response.routes).toHaveLength(2);
    expect(response.routes[1].is_alternative).toBe(true);
    expect(response.routes[1].geometry.coordinates).not.toEqual(
      response.routes[0].geometry.coordinates,
    );
    expect(response.routes[1].duration_s).toBe(600);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports an explicit no-route response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "NoRoute", routes: [] }), { status: 200 }),
      ),
    );

    await expect(routeLiveLocations(origin, destination)).rejects.toThrow(
      "No drivable route was found",
    );
  });

  it("rejects a provider route containing malformed coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "Ok",
            routes: [
              {
                distance: 100,
                duration: 10,
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [origin.lng, origin.lat],
                    ["invalid", null],
                    [destination.lng, destination.lat],
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(routeLiveLocations(origin, destination)).rejects.toThrow(
      "no usable route",
    );
  });

  it("rejects a provider route with zero distance or duration", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "Ok",
            routes: [{
              distance: 0,
              duration: 0,
              geometry: {
                type: "LineString",
                coordinates: [
                  [origin.lng, origin.lat],
                  [destination.lng, destination.lat],
                ],
              },
            }],
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(routeLiveLocations(origin, destination)).rejects.toThrow(
      "no usable route",
    );
  });

  it("reports invalid provider JSON as a routing provider error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not json", { status: 200 })),
    );

    await expect(routeLiveLocations(origin, destination)).rejects.toThrow(
      "invalid JSON",
    );
  });
});
