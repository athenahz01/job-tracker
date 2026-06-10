import { describe, expect, it } from "vitest";

import {
  buildPerformanceData,
  rate,
  type PerformanceApplication,
  type PerformanceEvent
} from "../lib/performance-calc";

describe("performance calculations", () => {
  it("groups by resume version, source, and tag with correct rates", () => {
    const data = buildPerformanceData(
      [
        application({ id: "saved", stage: "Saved", resume_version: "v1" }),
        application({
          id: "v1-quiet",
          stage: "Applied",
          resume_version: "v1",
          source: "extension",
          tags: ["remote"]
        }),
        application({
          id: "v1-response",
          stage: "Assessment",
          resume_version: "v1",
          source: "extension",
          tags: ["remote", "ai"]
        }),
        application({
          id: "v2-quiet",
          stage: "Applied",
          resume_version: "v2",
          source: "manual",
          tags: ["ai"]
        }),
        application({
          id: "v2-interview",
          stage: "Applied",
          resume_version: "v2",
          source: "manual",
          tags: ["ai"]
        }),
        application({
          id: "v2-offer",
          stage: "Offer",
          resume_version: "v2",
          source: "email",
          tags: []
        }),
        application({
          id: "not-set",
          stage: "Rejected",
          resume_version: null,
          source: null,
          tags: ["remote"]
        })
      ],
      [
        event({ application_id: "v2-interview", detected_stage: "Phone Screen" }),
        event({ application_id: "v2-offer", detected_stage: "Offer" })
      ]
    );

    expect(data.totalApplied).toBe(6);

    const resume = breakdown(data, "resumeVersion");
    expect(resume.groups.map((group) => group.label)).toEqual(["Not set", "v2", "v1"]);
    expect(group(resume, "v1").response).toMatchObject({
      numerator: 1,
      denominator: 2,
      display: "50%"
    });
    expect(group(resume, "v2").response).toMatchObject({
      numerator: 2,
      denominator: 3,
      display: "67%"
    });
    expect(group(resume, "v2").interview).toMatchObject({
      numerator: 2,
      denominator: 3,
      display: "67%"
    });
    expect(group(resume, "v2").offer).toMatchObject({
      numerator: 1,
      denominator: 3,
      display: "33%"
    });

    const source = breakdown(data, "source");
    expect(group(source, "extension").count).toBe(2);
    expect(group(source, "manual").response.display).toBe("50%");
    expect(group(source, "email").offer.display).toBe("100%");

    const tag = breakdown(data, "tag");
    expect(group(tag, "ai").count).toBe(3);
    expect(group(tag, "remote").count).toBe(3);
  });

  it("computes median days to first response only over applications with events", () => {
    const data = buildPerformanceData(
      [
        application({ id: "one-day", resume_version: "v1", first_seen: "2026-06-01T00:00:00.000Z" }),
        application({ id: "quiet", resume_version: "v1", first_seen: "2026-06-01T00:00:00.000Z" }),
        application({ id: "five-days", resume_version: "v1", first_seen: "2026-06-01T00:00:00.000Z" }),
        application({ id: "nine-days", resume_version: "v1", first_seen: "2026-06-01T00:00:00.000Z" })
      ],
      [
        event({ application_id: "one-day", received_at: "2026-06-02T00:00:00.000Z" }),
        event({ application_id: "five-days", received_at: "2026-06-06T00:00:00.000Z" }),
        event({ application_id: "nine-days", received_at: "2026-06-10T00:00:00.000Z" }),
        event({ application_id: "nine-days", received_at: "2026-06-20T00:00:00.000Z" })
      ]
    );

    const resumeGroup = group(breakdown(data, "resumeVersion"), "v1");
    expect(resumeGroup.medianDaysToFirstResponse).toBe(5);
    expect(resumeGroup.medianDaysDisplay).toBe("5d");
  });

  it("returns dashes for zero denominators and does not crown tiny samples", () => {
    const empty = buildPerformanceData([], []);
    expect(empty.totalApplied).toBe(0);
    expect(empty.breakdowns.every((breakdown) => breakdown.groups.length === 0)).toBe(true);
    expect(empty.summary.resumeVersion).toBe(
      "No resume version has enough applied roles yet to call a winner."
    );
    expect(rate(0, 0)).toMatchObject({
      percentage: null,
      display: "-"
    });

    const tiny = buildPerformanceData(
      [application({ id: "only", stage: "Rejected", resume_version: "tiny" })],
      []
    );
    expect(group(breakdown(tiny, "resumeVersion"), "tiny").response.display).toBe("100%");
    expect(tiny.summary.resumeVersion).toBe(
      "No resume version has enough applied roles yet to call a winner."
    );
  });

  it("crowns a leader only after a meaningful sample", () => {
    const data = buildPerformanceData(
      [
        application({ id: "a1", stage: "Rejected", resume_version: "alpha", source: "manual" }),
        application({ id: "a2", stage: "Rejected", resume_version: "alpha", source: "manual" }),
        application({ id: "a3", stage: "Rejected", resume_version: "alpha", source: "manual" }),
        application({ id: "a4", stage: "Applied", resume_version: "alpha", source: "manual" }),
        application({ id: "a5", stage: "Applied", resume_version: "alpha", source: "manual" }),
        application({ id: "b1", stage: "Rejected", resume_version: "beta", source: "email" })
      ],
      []
    );

    expect(data.summary.resumeVersion).toBe(
      "alpha leads resume version performance with 60% responses (3 of 5)."
    );
    expect(data.summary.source).toBe(
      "manual leads source performance with 60% responses (3 of 5)."
    );
  });
});

function breakdown(
  data: ReturnType<typeof buildPerformanceData>,
  key: "resumeVersion" | "source" | "tag"
) {
  const found = data.breakdowns.find((item) => item.key === key);
  if (!found) {
    throw new Error(`Missing ${key} breakdown.`);
  }
  return found;
}

function group(
  breakdown: ReturnType<typeof buildPerformanceData>["breakdowns"][number],
  label: string
) {
  const found = breakdown.groups.find((item) => item.label === label);
  if (!found) {
    throw new Error(`Missing ${label} group.`);
  }
  return found;
}

function application(overrides: Partial<PerformanceApplication>): PerformanceApplication {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    source: overrides.source ?? "manual",
    stage: overrides.stage ?? "Applied",
    kind: "application",
    merged_into_id: null,
    first_seen: overrides.first_seen ?? "2026-06-01T00:00:00.000Z",
    resume_version: overrides.resume_version ?? "v1",
    tags: overrides.tags ?? [],
    ...overrides
  };
}

function event(overrides: Partial<PerformanceEvent>): PerformanceEvent {
  return {
    application_id: overrides.application_id ?? "application",
    detected_stage: overrides.detected_stage ?? null,
    received_at: overrides.received_at ?? "2026-06-02T00:00:00.000Z",
    ...overrides
  };
}
