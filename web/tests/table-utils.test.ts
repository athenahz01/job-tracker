import { describe, expect, it } from "vitest";

import type { ApplicationRow } from "../lib/dashboard-data";
import { filterAndSortApplications, parseTableState } from "../lib/table-utils";

describe("table utilities", () => {
  it("parses table filters and sort state from URL params", () => {
    const state = parseTableState({
      view: "table",
      stage: "Interview",
      q: "acme",
      tag: "remote",
      priority: "High",
      orphan: "1",
      active: "1",
      sort: "company",
      dir: "asc",
      quietDays: "9"
    });

    expect(state).toMatchObject({
      view: "table",
      sortKey: "company",
      sortDirection: "asc",
      quietDays: 9,
      filters: {
        stage: "Interview",
        query: "acme",
        tag: "remote",
        priority: "High",
        orphanOnly: true,
        activeOnly: true,
        highFitOnly: false
      }
    });
  });

  it("filters rows and sorts the visible result", () => {
    const rows = [
      application({
        company: "Zenith",
        priority: "Low",
        tags: ["onsite"],
        last_activity: "2026-05-01T00:00:00.000Z"
      }),
      application({
        company: "Acme",
        priority: "High",
        tags: ["remote"],
        location: "New York",
        last_activity: "2026-06-01T00:00:00.000Z"
      }),
      application({
        company: "Acme Labs",
        priority: "High",
        tags: ["remote"],
        location: "Boston",
        last_activity: "2026-06-03T00:00:00.000Z"
      })
    ];

    const result = filterAndSortApplications(
      rows,
      {
        query: "acme",
        tag: "remote",
        priority: "High",
        orphanOnly: false,
        activeOnly: false,
        highFitOnly: false
      },
      "last_activity",
      "desc"
    );

    expect(result.map((row) => row.company)).toEqual(["Acme Labs", "Acme"]);
  });

  it("filters high fit rows and sorts by fit score", () => {
    const rows = [
      application({ company: "Low", fit_score: 39 }),
      application({ company: "Medium", fit_score: 69 }),
      application({ company: "High", fit_score: 88 }),
      application({ company: "Higher", fit_score: 94 })
    ];

    const result = filterAndSortApplications(
      rows,
      {
        orphanOnly: false,
        activeOnly: false,
        highFitOnly: true
      },
      "fit_score",
      "desc"
    );

    expect(result.map((row) => row.company)).toEqual(["Higher", "High"]);
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
    requirement_matches: [],
    requirements_scored_at: null,
    ai_tailored_bullets: [],
    ai_cover_letter: null,
    tailored_at: null,
    ai_tailored_resume: null,
    tailored_resume_at: null,
    ai_interview_prep: null,
    interview_prep_at: null,
    first_seen: "2026-01-01T00:00:00.000Z",
    last_activity: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}
