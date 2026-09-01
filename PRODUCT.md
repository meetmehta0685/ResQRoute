# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js with TypeScript as a single full-stack application. The user explicitly chose Next.js for both the interface and backend.

## Users

The primary user is a student dispatcher or evaluator who selects an emergency origin and destination, changes operating conditions, and studies how the route changes.

## Product Purpose

ResQRoute helps the user compare an ordinary shortest-travel-time route with an emergency route selected using fuzzy logic and ant colony optimization. The first version should be a production-oriented prototype that can be demonstrated reliably, tested locally, and extended toward live operational data.

## Positioning

ResQRoute makes the route decision explainable. It shows how uncertain traffic, road risk, and emergency urgency influence the route instead of presenting an opaque optimized line.

## Operating Context

The user works from a browser during a project demonstration or evaluation. They search real places, inspect their coordinates on an interactive map, answer traffic and urgency questions, and compare a normal Dijkstra route with a fuzzy/ACO route selected from live provider candidates. The initial project brief does not provide a live traffic provider, road dataset, dispatch integration, or operational deployment environment.

## Capabilities and Constraints

- The core project must use fuzzy logic and ant colony optimization for emergency route selection.
- The application must expose a backend through the same Next.js project as the frontend.
- The first usable workflow is single-origin, single-destination route comparison.
- A production prototype is the chosen target for the first version. The live map now uses MapLibre with provider-configurable styles, server-side geocoding, and an OSRM-compatible route adapter. Dijkstra and fuzzy/ACO operate over the provider's available route candidates; live traffic, GPS, multi-vehicle dispatch, authentication, data retention, and deployment remain open follow-up work.
- Keep algorithm results deterministic for a supplied seed so demonstrations and tests can be repeated.
- Do not present the prototype as a certified emergency-dispatch or navigation system.

## Brand Commitments

- Product name: ResQRoute.
- The interface should use direct, operational language and make the algorithm's reasoning visible.

## Evidence on Hand

- The shared ChatGPT brief proposes the title "Intelligent Emergency Vehicle Routing Using Fuzzy Logic and Ant Colony Optimization" and lists fuzzy logic and ACO as the project methods.
- No real road network, traffic feed, customer evidence, deployment target, logo, or visual reference was supplied.

## Product Principles

- Show the decision, not only the result.
- Keep experiments repeatable.
- Make safety and time tradeoffs visible.
- Treat external operational data as an explicit integration, not an invisible dependency.
- Keep map, geocoding, and routing providers replaceable behind server-side adapters.

## Accessibility & Inclusion

Open decision: confirm the target accessibility standard and any specific user needs. The initial implementation should still provide keyboard access, visible focus, readable contrast, and route distinctions that do not depend on color alone.
