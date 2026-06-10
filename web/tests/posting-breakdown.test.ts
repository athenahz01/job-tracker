import { describe, expect, it } from "vitest";

import { buildPostingBreakdown } from "../lib/posting-breakdown";

describe("posting breakdown", () => {
  it("structures common posting sections without inventing content", () => {
    const breakdown = buildPostingBreakdown({
      notes: [
        "Responsibilities:",
        "- Build dashboards for product teams.",
        "- Partner with engineering on event quality.",
        "Requirements",
        "- 3+ years with SQL.",
        "- Experience with experimentation.",
        "Nice to haves: Python automation",
        "Compensation: $120,000 - $150,000",
        "Location: Remote US"
      ].join("\n"),
      salary: "$120,000 - $150,000",
      location: "Remote US"
    });

    expect(sectionItems(breakdown, "Responsibilities")).toEqual([
      "Build dashboards for product teams.",
      "Partner with engineering on event quality."
    ]);
    expect(sectionItems(breakdown, "Requirements")).toEqual([
      "3+ years with SQL.",
      "Experience with experimentation."
    ]);
    expect(sectionItems(breakdown, "Nice-to-haves")).toEqual(["Python automation"]);
    expect(sectionItems(breakdown, "Compensation")).toEqual(["$120,000 - $150,000"]);
    expect(sectionItems(breakdown, "Location")).toEqual(["Remote US"]);
    expect(breakdown.rawNotes).toContain("Responsibilities:");
  });

  it("falls back to raw notes when there is no confident structure", () => {
    const breakdown = buildPostingBreakdown({
      notes: "A thoughtful team working on interesting internal tooling.",
      salary: null,
      location: null
    });

    expect(breakdown.sections).toEqual([]);
    expect(breakdown.rawNotes).toBe("A thoughtful team working on interesting internal tooling.");
  });

  it("caps noisy sections", () => {
    const breakdown = buildPostingBreakdown({
      notes: [
        "Requirements",
        "- Requirement 1",
        "- Requirement 2",
        "- Requirement 3",
        "- Requirement 4",
        "- Requirement 5",
        "- Requirement 6",
        "- Requirement 7",
        "- Requirement 8",
        "- Requirement 9"
      ].join("\n")
    });

    expect(sectionItems(breakdown, "Requirements")).toHaveLength(8);
  });
});

function sectionItems(
  breakdown: ReturnType<typeof buildPostingBreakdown>,
  label: string
) {
  return breakdown.sections.find((section) => section.label === label)?.items ?? [];
}
