export const stages = [
  "Saved",
  "Applied",
  "Assessment",
  "Phone Screen",
  "Interview",
  "Final",
  "Offer",
  "Rejected",
  "Ghosted"
] as const;

export type Stage = (typeof stages)[number];

export const stageRank: Partial<Record<Stage, number>> = {
  Saved: 0,
  Applied: 10,
  Assessment: 20,
  "Phone Screen": 30,
  Interview: 40,
  Final: 50,
  Offer: 60
};

export function resolveForwardStage(current: Stage, detected: Stage): Stage {
  if (current === "Offer" || current === "Rejected") {
    return current;
  }

  if (detected === "Rejected") {
    return "Rejected";
  }

  const detectedRank = stageRank[detected];
  if (detectedRank === undefined) {
    return current;
  }

  if (current === "Ghosted") {
    return detected;
  }

  const currentRank = stageRank[current];
  if (currentRank === undefined) {
    return current;
  }

  return detectedRank > currentRank ? detected : current;
}

/*
Examples:
resolveForwardStage("Applied", "Interview") returns "Interview".
resolveForwardStage("Interview", "Assessment") returns "Interview".
resolveForwardStage("Final", "Rejected") returns "Rejected".
resolveForwardStage("Offer", "Rejected") returns "Offer".
resolveForwardStage("Ghosted", "Phone Screen") returns "Phone Screen".
*/
