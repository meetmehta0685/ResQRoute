# Evaluation

Run the local evaluation with:

```bash
npm run evaluate
```

The runner evaluates clear and heavy traffic scenarios over five seeds. It reports route-found rate, route changes, mean fuzzy cost, and mean runtime. A route change is expected in the heavy-traffic scenario because the fuzzy evaluator penalizes the congested north corridor.

The baseline and optimized route should be read together. A higher optimized base travel time is not automatically a failure. The intended tradeoff is visible when the optimized route takes longer in raw seconds but has a lower fuzzy cost because it avoids a risky or congested edge.

These results apply only to the checked-in fixture graph. A future live-data integration must record its data timestamp and provider metadata and must keep the fixture evaluation as a regression baseline.
