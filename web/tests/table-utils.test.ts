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
        activeOnly: true
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
        activeOnly: false
      },
      "last_activity",
      "desc"
    );

    expect(result.map((row) => row.company)).toEqual(["Acme Labs", "Acme"]);
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
    first_seen: "2026-01-01T00:00:00.000Z",
    last_activity: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}
