import type { Stage } from "./stages";
import type { Priority } from "./tracker";

export function stageClass(stage: Stage) {
  return `stage-${stage.toLowerCase().replace(/\s+/g, "-")}`;
}

export function priorityClass(priority: Priority | null) {
  return priority ? `priority-${priority.toLowerCase()}` : "priority-empty";
}
