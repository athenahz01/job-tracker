import { describe, expect, it } from "vitest";

import type { ApplicationRow, ContactRow } from "../lib/dashboard-data";
import { buildFollowUpItems } from "../lib/followups";

describe("follow-up selection", () => {
  it("includes due applications, quiet active applications, and due contacts", () => {
    const today = new Date("2026-06-08T12:00:00.000Z");
    const items = buildFollowUpItems(
      [
        application({
          id: "00000000-0000-4000-8000-000000000001",
          company: "Due Co",
          follow_up_on: "2026-06-08"
        }),
        application({
          id: "00000000-0000-4000-8000-000000000002",
          company: "Quiet Co",
          stage: "Interview",
          last_activity: "2026-05-20T00:00:00.000Z"
        }),
        application({
          id: "00000000-0000-4000-8000-000000000003",
          company: "Closed Co",
          stage: "Rejected",
          last_activity: "2026-05-01T00:00:00.000Z"
        })
      ],
      [
        contact({
          id: "00000000-0000-4000-8000-000000000004",
          name: "Avery Recruiter",
          next_follow_up: "2026-06-07"
        }),
        contact({
          id: "00000000-0000-4000-8000-000000000005",
          name: "Future Person",
          next_follow_up: "2026-06-10"
        })
      ],
      today,
      14
    );

    expect(items.map((item) => item.title)).toEqual([
      "Quiet Co",
      "Avery Recruiter",
      "Due Co"
    ]);
    expect(items.map((item) => item.kind)).toEqual([
      "quiet_application",
      "contact_due",
      "application_due"
    ]);
  });
});

function application(overrides: Partial<ApplicationRow>): ApplicationRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    company: "Company",
    normalized_company: "company",
    company_domain: null,
    role: "Role",
    source: "manual",
    url: null,
    stage: "Applied",
    is_orphan: false,
    merged_into_id: null,
    stage_locked: false,
    kind: "application",
    notes: null,
    next_action: null,
    follow_up_on: null,
    salary: null,
    location: null,
    deadline: null,
    priority: null,
    tags: [],
    resume_version: null,
    fit_score: null,
    fit_summary: null,
    missing_keywords: [],
    scored_at: null,
    ai_tailored_bullets: [],
    ai_cover_letter: null,
    tailored_at: null,
    first_seen: "2026-01-01T00:00:00.000Z",
    last_activity: "2026-06-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function contact(overrides: Partial<ContactRow>): ContactRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: "Contact",
    company: null,
    title: null,
    email: null,
    linkedin_url: null,
    relationship: null,
    application_id: null,
    notes: null,
    last_contacted: null,
    next_follow_up: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}
