import { fitScoreClass } from "../lib/style-utils";

type FitScoreBadgeProps = {
  score: number | null;
};

export default function FitScoreBadge({ score }: FitScoreBadgeProps) {
  return (
    <span className={`fit-badge ${fitScoreClass(score)}`}>
      {score === null ? "Not scored" : score}
    </span>
  );
}
