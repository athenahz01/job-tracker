import { describe, expect, it } from "vitest";

import {
  buildInsightsData,
  type InsightsApplication,
  type InsightsEvent
} from "../lib/insights-calc";

describe("insights calculations", () => {
  it("calculates response, interview, and offer rates for mixed applications", () => {
    const data = buildInsightsData(
      [
        application({ id: "saved", stage: "Saved" }),
        application({ id: "quiet", stage: "Applied", source: "extension" }),
        application({ id: "created", stage: "Applied", source: "email" }),
        application({ id: "ghosted", stage: "Ghosted", source: "extension" }),
        application({ id: "rejected", stage: "Rejected", source: "email" }),
        application({ id: "assessment", stage: "Applied", source: "manual" }),
        application({ id: "interview", stage: "Rejected", source: "email" }),
        application({ id: "offer", stage: "Offer", source: "manual" })
      ],
      [
        event({ application_id: "created", detected_stage: null }),
        event({ application_id: "assessment", detected_stage: "Assessment" }),
        event({ application_id: "interview", detected_stage: "Interview" }),
        event({ application_id: "offer", detected_stage: "Offer" })
      ]
    );

    expect(data.totalApplied).toBe(7);
    expect(data.savedBacklog).toBe(1);
    expect(data.rates.response).toMatchObject({
      numerator: 4,
      denominator: 7,
      display: "57%"
    });
    expect(data.rates.interview).toMatchObject({
      numerator: 2,
      denominator: 7,
      display: "29%"
    });
    expect(data.rates.offer).toMatchObject({
      numerator: 1,
      denominator: 7,
      display: "14%"
    });
  });

  it("does not count a creating email event as a response without stage progress", () => {
    const data = buildInsightsData(
      [
        application({ id: "created-only", stage: "Applied" }),
        application({ id: "advanced", stage: "Assessment" })
      ],
      [event({ application_id: "created-only", detected_stage: null })]
    );

    expect(data.rates.response).toMatchObject({
      numerator: 1,
      denominator: 2,
      display: "50%"
    });
    expect(data.funnel.find((step) => step.key === "responded")).toMatchObject({
      count: 1
    });
    expect(data.funnel.find((step) => step.key === "assessment")).toMatchObject({
      count: 1
    });
  });

  it("handles all-ghosted, single-application, and zero-application edges", () => {
    const ghosted = buildInsightsData(
      [
        application({ id: "one", stage: "Ghosted" }),
        application({ id: "two", stage: "Ghosted" })
      ],
      []
    );
    expect(ghosted.rates.response.display).toBe("0%");
    expect(ghosted.rates.interview.display).toBe("0%");

    const single = buildInsightsData(
      [application({ id: "one", stage: "Rejected" })],
      []
    );
    expect(single.rates.response).toMatchObject({
      numerator: 1,
      denominator: 1,
      display: "100%"
    });

    const empty = buildInsightsData([], []);
    expect(empty.rates.response).toMatchObject({
      numerator: 0,
      denominator: 0,
      display: "-"
    });
    expect(empty.funnel.every((step) => !step.conversion || step.conversion.display === "-")).toBe(
      true
    );
  });

  it("reconstructs furthest stage so rejected after interview counts in the funnel", () => {
    const data = buildInsightsData(
      [application({ id: "rejected-after-interview", stage: "Rejected" })],
      [
        event({
          application_id: "rejected-after-interview",
          detected_stage: "Interview"
        })
      ]
    );

    expect(data.funnel.find((step) => step.key === "interview")).toMatchObject({
      count: 1
    });
    expect(data.funnel.find((step) => step.key === "offer")).toMatchObject({
      count: 0
    });
    expect(data.rates.interview.display).toBe("100%");
  });

});

function application(overrides: Partial<InsightsApplication>): InsightsApplication {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    company: overrides.company ?? "Acme",
    source: overrides.source ?? "manual",
    stage: overrides.stage ?? "Applied",
    kind: "application",
    merged_into_id: null,
    first_seen: overrides.first_seen ?? "2026-06-01T00:00:00.000Z",
    tags: [],
    ...overrides
  };
}

function event(overrides: Partial<InsightsEvent>): InsightsEvent {
  return {
    application_id: overrides.application_id ?? "application",
    detected_stage: overrides.detected_stage ?? null,
    received_at: overrides.received_at ?? "2026-06-02T00:00:00.000Z",
    ...overrides
  };
}
