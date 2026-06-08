import { stageRank, type Stage } from "./stages";

export const activeFlowStages = [
  "Applied",
  "Assessment",
  "Phone Screen",
  "Interview",
  "Final",
  "Offer"
] as const satisfies readonly Stage[];

export function getFurthestActiveStage(currentStage: Stage, detectedStages: Stage[]) {
  const touched = new Set<Stage>(["Applied"]);
  for (const stage of detectedStages) {
    if (isActiveFlowStage(stage)) {
      touched.add(stage);
    }
  }
  if (isActiveFlowStage(currentStage)) {
    touched.add(currentStage);
  }

  return [...touched].reduce<Stage>(
    (furthest, stage) =>
      (stageRank[stage] ?? 0) > (stageRank[furthest] ?? 0) ? stage : furthest,
    "Applied"
  );
}

export function isActiveFlowStage(stage: Stage): stage is (typeof activeFlowStages)[number] {
  return activeFlowStages.includes(stage as (typeof activeFlowStages)[number]);
}
