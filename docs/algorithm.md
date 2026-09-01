# Routing model

ResQRoute compares two paths through a small, versioned directed graph.

## Baseline

The baseline uses Dijkstra's algorithm and minimizes the sum of `base_time_s` on each edge. It represents the route a simple fastest-time system would choose.

## Fuzzy cost

Each edge has normalized congestion and road-risk values. The request supplies traffic level and emergency urgency. The evaluator calculates:

```text
traffic_input = clamp(edge.congestion * traffic_level, 0, 1)
fuzzy_cost_s = edge.base_time_s * (1 + fuzzy_penalty)
```

Low, medium, and high membership functions cover the `[0, 1]` input range. Rules use max-min firing and weighted singleton defuzzification. The named rules live in `lib/algorithms/fuzzy.ts` so the API can expose the dominant conditions.

## Ant colony optimization

Each ant builds a path by choosing an unvisited outgoing edge with probability proportional to:

```text
pheromone(edge)^alpha * (1 / fuzzy_cost(edge))^beta
```

After each iteration pheromone evaporates, then complete paths deposit pheromone proportional to the inverse of their total fuzzy cost. The seeded random generator makes the same request reproducible. Incomplete paths are discarded. If no ant reaches the destination, the service returns the baseline route with an explicit fallback flag.

## Scope

The graph is synthetic demonstration data. The system does not account for live traffic, closures, weather, ambulance capabilities, or safety certification.
