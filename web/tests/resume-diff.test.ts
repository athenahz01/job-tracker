import { describe, expect, it } from "vitest";

import { buildResumeDiff } from "../lib/resume-diff";

describe("resume diff", () => {
  it("marks same, removed, and added lines for a tailored variant", () => {
    const diff = buildResumeDiff(
      ["Summary", "Built dashboards", "Used SQL"].join("\n"),
      ["Summary", "Built analytics dashboards", "Used SQL", "Emphasized stakeholder reporting"].join("\n")
    );

    expect(diff.map((line) => [line.type, line.text])).toEqual([
      ["same", "Summary"],
      ["removed", "Built dashboards"],
      ["added", "Built analytics dashboards"],
      ["same", "Used SQL"],
      ["added", "Emphasized stakeholder reporting"]
    ]);
  });
});
