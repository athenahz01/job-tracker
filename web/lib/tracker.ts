import type { Stage } from "./stages";

export const priorities = ["High", "Medium", "Low"] as const;
export type Priority = (typeof priorities)[number];

export const relationships = [
  "recruiter",
  "referral",
  "hiring_manager",
  "peer",
  "alum",
  "other"
] as const;
export type Relationship = (typeof relationships)[number];

export const activeApplicationStages: Stage[] = [
  "Applied",
  "Assessment",
  "Phone Screen",
  "Interview",
  "Final",
  "Offer"
];

export function isPriority(value: string): value is Priority {
  return priorities.includes(value as Priority);
}

export function isRelationship(value: string): value is Relationship {
  return relationships.includes(value as Relationship);
}
