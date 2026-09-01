import type { RoadEdge } from "../types";

export type FuzzyLabel = "low" | "medium" | "high";
export type FuzzyConsequent = FuzzyLabel | "critical";

export interface FuzzyRuleResult {
  id: string;
  strength: number;
  consequent: FuzzyConsequent;
}

export interface FuzzyEvaluation {
  traffic_input: number;
  risk_input: number;
  urgency_input: number;
  penalty: number;
  effective_cost_s: number;
  fired_rules: FuzzyRuleResult[];
  dominant_rule_ids: string[];
}

const CONSEQUENT_VALUES: Record<FuzzyConsequent, number> = {
  low: 0.1,
  medium: 0.45,
  high: 0.9,
  critical: 1.3,
};

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function lowMembership(value: number): number {
  if (value <= 0.25) return 1;
  if (value >= 0.5) return 0;
  return (0.5 - value) / 0.25;
}

function mediumMembership(value: number): number {
  if (value <= 0.25 || value >= 0.75) return 0;
  if (value === 0.5) return 1;
  return value < 0.5 ? (value - 0.25) / 0.25 : (0.75 - value) / 0.25;
}

function highMembership(value: number): number {
  if (value <= 0.5) return 0;
  if (value >= 0.75) return 1;
  return (value - 0.5) / 0.25;
}

export function membership(value: number): Record<FuzzyLabel, number> {
  const normalized = clamp(value);
  return {
    low: lowMembership(normalized),
    medium: mediumMembership(normalized),
    high: highMembership(normalized),
  };
}

function minimum(...values: number[]): number {
  return Math.min(...values);
}

function maximum(...values: number[]): number {
  return Math.max(...values);
}

export function evaluateEdge(
  edge: RoadEdge,
  trafficLevel: number,
  urgency: number,
): FuzzyEvaluation {
  const trafficInput = clamp(edge.congestion * clamp(trafficLevel));
  const riskInput = clamp(edge.risk);
  const urgencyInput = clamp(urgency);
  const traffic = membership(trafficInput);
  const risk = membership(riskInput);
  const urgencyMembership = membership(urgencyInput);

  const candidateRules: FuzzyRuleResult[] = [
    {
      id: "R1_SAFE_LOW_TRAFFIC",
      strength: minimum(traffic.low, risk.low),
      consequent: "low",
    },
    {
      id: "R2_HIGH_TRAFFIC",
      strength: traffic.high,
      consequent: "high",
    },
    {
      id: "R3_HIGH_RISK",
      strength: risk.high,
      consequent: "high",
    },
    {
      id: "R4_TRAFFIC_AND_RISK_CRITICAL",
      strength: minimum(traffic.high, risk.high),
      consequent: "critical",
    },
    {
      id: "R5_URGENT_MEDIUM_TRAFFIC",
      strength: minimum(urgencyMembership.high, traffic.medium, risk.low),
      consequent: "medium",
    },
    {
      id: "R6_LOW_URGENCY_MEDIUM_RISK",
      strength: minimum(urgencyMembership.low, risk.medium),
      consequent: "high",
    },
    {
      id: "R7_MEDIUM_TRAFFIC_AND_RISK",
      strength: minimum(traffic.medium, risk.medium),
      consequent: "high",
    },
  ];
  const rules = candidateRules.filter((rule) => rule.strength > 0);

  const firedRules = rules.length
    ? rules
    : [{ id: "R8_DEFAULT_MEDIUM", strength: 1, consequent: "medium" as const }];
  const totalStrength = firedRules.reduce((sum, rule) => sum + rule.strength, 0);
  const penalty =
    firedRules.reduce(
      (sum, rule) => sum + rule.strength * CONSEQUENT_VALUES[rule.consequent],
      0,
    ) / totalStrength;
  const effectiveCost = edge.base_time_s * (1 + penalty);
  const strongest = Math.max(...firedRules.map((rule) => rule.strength));

  return {
    traffic_input: trafficInput,
    risk_input: riskInput,
    urgency_input: urgencyInput,
    penalty,
    effective_cost_s: effectiveCost,
    fired_rules: firedRules,
    dominant_rule_ids: firedRules
      .filter((rule) => rule.strength === strongest)
      .map((rule) => rule.id),
  };
}

export function effectiveEdgeCost(
  edge: RoadEdge,
  trafficLevel: number,
  urgency: number,
): number {
  return evaluateEdge(edge, trafficLevel, urgency).effective_cost_s;
}

export function explainRule(ruleId: string): string {
  const descriptions: Record<string, string> = {
    R1_SAFE_LOW_TRAFFIC: "Low traffic and low risk",
    R2_HIGH_TRAFFIC: "High traffic",
    R3_HIGH_RISK: "High road risk",
    R4_TRAFFIC_AND_RISK_CRITICAL: "High traffic and high risk",
    R5_URGENT_MEDIUM_TRAFFIC: "Urgency makes medium traffic matter more",
    R6_LOW_URGENCY_MEDIUM_RISK: "Medium risk with lower urgency",
    R7_MEDIUM_TRAFFIC_AND_RISK: "Medium traffic and medium risk",
    R8_DEFAULT_MEDIUM: "Balanced conditions",
  };
  return descriptions[ruleId] ?? ruleId;
}

export function dominantRuleIds(evaluations: FuzzyEvaluation[]): string[] {
  const scores = new Map<string, number>();
  for (const evaluation of evaluations) {
    for (const rule of evaluation.fired_rules) {
      scores.set(rule.id, Math.max(scores.get(rule.id) ?? 0, rule.strength));
    }
  }
  return [...scores.entries()]
    .sort(([firstId, firstScore], [secondId, secondScore]) => {
      return secondScore - firstScore || firstId.localeCompare(secondId);
    })
    .slice(0, 3)
    .map(([id]) => id);
}

export function maxRuleStrength(evaluation: FuzzyEvaluation): number {
  return maximum(...evaluation.fired_rules.map((rule) => rule.strength));
}
