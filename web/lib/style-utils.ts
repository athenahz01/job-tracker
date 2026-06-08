import type { Stage } from "./stages";
import type { Priority } from "./tracker";

export function stageClass(stage: Stage) {
  return `stage-${stage.toLowerCase().replace(/\s+/g, "-")}`;
}

export function priorityClass(priority: Priority | null) {
  return priority ? `priority-${priority.toLowerCase()}` : "priority-empty";
}

export function fitScoreClass(score: number | null) {
  if (score === null) {
    return "fit-empty";
  }
  if (score >= 70) {
    return "fit-high";
  }
  if (score >= 40) {
    return "fit-medium";
  }
  return "fit-low";
}
