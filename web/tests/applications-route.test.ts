import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MockApplication = {
  id: string;
  company: string;
  normalized_company: string;
  company_domain: string | null;
  role: string | null;
  source: string | null;
  url: string | null;
  stage: string;
  is_orphan: boolean;
  merged_into_id: string | null;
  stage_locked: boolean;
  kind: "application";
  notes: string | null;
  salary: string | null;
  location: string | null;
  tags: string[];
  first_seen: string;
  last_activity: string;
  created_at: string;
  updated_at: string;
};

const mockSupabase = vi.hoisted(() => {
  type Filter = {
    column: string;
    kind: "eq" | "gte" | "is";
    value: unknown;
  };

  const state = {
    applications: [] as MockApplication[],
    nextId: 1
  };

  class ApplicationQuery {
    private filters: Filter[] = [];
    private insertValue: Partial<MockApplication> | null = null;
    private limitValue: number | null = null;
    private orderColumn: string | null = null;
    private orderAscending = true;
    private updateValue: Partial<MockApplication> | null = null;

    select() {
      return this;
    }

    insert(value: Partial<MockApplication>) {
      this.insertValue = value;
      return this;
    }

    update(value: Partial<MockApplication>) {
      this.updateValue = value;
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, kind: "eq", value });
      return this;
    }

    gte(column: string, value: unknown) {
      this.filters.push({ column, kind: "gte", value });
      return this;
    }

    is(column: string, value: unknown) {
      this.filters.push({ column, kind: "is", value });
      return this;
    }

    limit(value: number) {
      this.limitValue = value;
      return this;
    }

    order(column: string, options: { ascending?: boolean } = {}) {
      this.orderColumn = column;
      this.orderAscending = options.ascending ?? true;
      return this;
    }

    async maybeSingle() {
      return {
        data: this.matchRows()[0] ?? null,
        error: null
      };
    }

    async single() {
      if (this.insertValue) {
        const now = new Date().toISOString();
        const row: MockApplication = {
          id: `application-${state.nextId}`,
          company: "",
          normalized_company: "",
          company_domain: null,
          role: null,
          source: null,
          url: null,
          stage: "Saved",
          is_orphan: false,
          merged_into_id: null,
          stage_locked: false,
          kind: "application",
          notes: null,
          salary: null,
          location: null,
          tags: [],
          first_seen: now,
          last_activity: now,
          created_at: now,
          updated_at: now,
          ...this.insertValue
        };
        state.nextId += 1;
        state.applications.push(row);
        return { data: row, error: null };
      }

      if (this.updateValue) {
        const row = this.matchRows()[0];
        if (!row) {
          return { data: null, error: new Error("Application not found.") };
        }

        Object.assign(row, this.updateValue);
        return { data: row, error: null };
      }

      return {
        data: this.matchRows()[0] ?? null,
        error: null
      };
    }

    private matchRows() {
      let rows = [...state.applications];

      for (const filter of this.filters) {
        rows = rows.filter((row) => {
          const value = row[filter.column as keyof MockApplication];
          if (filter.kind === "eq") {
            return value === filter.value;
          }
          if (filter.kind === "is") {
            return value === filter.value;
          }
          return String(value) >= String(filter.value);
        });
      }

      if (this.orderColumn) {
        rows.sort((left, right) => {
          const leftValue = String(left[this.orderColumn as keyof MockApplication]);
          const rightValue = String(right[this.orderColumn as keyof MockApplication]);
          return this.orderAscending
            ? leftValue.localeCompare(rightValue)
            : rightValue.localeCompare(leftValue);
        });
      }

      return this.limitValue === null ? rows : rows.slice(0, this.limitValue);
    }
  }

  return {
    state,
    createClient: () => ({
      from: (table: string) => {
        if (table !== "applications") {
          throw new Error(`Unexpected table ${table}.`);
        }
        return new ApplicationQuery();
      }
    })
  };
});

vi.mock("../lib/supabase", () => ({
  createSupabaseServerClient: mockSupabase.createClient
}));

import { POST } from "../app/api/applications/route";

describe("applications route", () => {
  beforeEach(() => {
    process.env.EXTENSION_API_SECRET = "test-secret";
    mockSupabase.state.applications = [];
    mockSupabase.state.nextId = 1;
  });

  it("creates a saved application when stage is missing", async () => {
    const { body, response } = await postApplication({
      company: "Acme Inc",
      role: "Designer",
      url: "https://jobs.example.com/acme/designer"
    });

    expect(response.status).toBe(201);
    expect(body.stage).toBe("Saved");
    expect(body.deduped).toBe(false);
  });

  it("creates an applied application when stage is Applied", async () => {
    const { body, response } = await postApplication({
      company: "Bravo",
      role: "Engineer",
      stage: "Applied",
      url: "https://jobs.example.com/bravo/engineer"
    });

    expect(response.status).toBe(201);
    expect(body.stage).toBe("Applied");
    expect(body.deduped).toBe(false);
  });

  it("stores salary, location, and cleaned tags on insert", async () => {
    const { body, response } = await postApplication({
      company: "Finch",
      role: "Data Scientist",
      stage: "Saved",
      url: "https://jobs.example.com/finch/data",
      salary: "  $120k to $150k  ",
      location: "  Remote US  ",
      tags: [" remote ", "ai", "", "Remote", "very-long-tag-name-that-should-be-trimmed-at-forty-characters"]
    });

    expect(response.status).toBe(201);
    expect(body.salary).toBe("$120k to $150k");
    expect(body.location).toBe("Remote US");
    expect(body.tags).toEqual([
      "remote",
      "ai",
      "Remote",
      "very-long-tag-name-that-should-be-trimme"
    ]);
  });

  it("advances an existing saved application to applied", async () => {
    await postApplication({
      company: "Cobalt",
      role: "Product Manager",
      url: "https://jobs.example.com/cobalt/product"
    });
    mockSupabase.state.applications[0].last_activity = "2024-01-01T00:00:00.000Z";

    const { body, response } = await postApplication({
      company: "Cobalt",
      role: "Product Manager",
      stage: "Applied",
      url: "https://jobs.example.com/cobalt/product"
    });

    expect(response.status).toBe(200);
    expect(body.deduped).toBe(true);
    expect(body.id).toBe("application-1");
    expect(body.stage).toBe("Applied");
    expect(mockSupabase.state.applications).toHaveLength(1);
    expect(mockSupabase.state.applications[0].last_activity).not.toBe(
      "2024-01-01T00:00:00.000Z"
    );
  });

  it("does not move an applied application backward to saved", async () => {
    await postApplication({
      company: "Delta",
      role: "Engineer",
      stage: "Applied",
      url: "https://jobs.example.com/delta/engineer"
    });
    mockSupabase.state.applications[0].last_activity = "2024-01-01T00:00:00.000Z";

    const { body } = await postApplication({
      company: "Delta",
      role: "Engineer",
      stage: "Saved",
      url: "https://jobs.example.com/delta/engineer"
    });

    expect(body.deduped).toBe(true);
    expect(body.stage).toBe("Applied");
    expect(mockSupabase.state.applications).toHaveLength(1);
    expect(mockSupabase.state.applications[0].last_activity).toBe(
      "2024-01-01T00:00:00.000Z"
    );
  });

  it("does not advance a stage locked row", async () => {
    await postApplication({
      company: "Evergreen",
      role: "Analyst",
      url: "https://jobs.example.com/evergreen/analyst"
    });
    Object.assign(mockSupabase.state.applications[0], {
      last_activity: "2024-01-01T00:00:00.000Z",
      stage_locked: true
    });

    const { body } = await postApplication({
      company: "Evergreen",
      role: "Analyst",
      stage: "Applied",
      url: "https://jobs.example.com/evergreen/analyst"
    });

    expect(body.deduped).toBe(true);
    expect(body.stage).toBe("Saved");
    expect(mockSupabase.state.applications[0].last_activity).toBe(
      "2024-01-01T00:00:00.000Z"
    );
  });

  it("fills empty deduped fields and unions tags without overwriting", async () => {
    await postApplication({
      company: "Granite",
      role: "Engineer",
      url: "https://jobs.example.com/granite/engineer",
      salary: "$100k to $120k",
      tags: ["backend", "remote"]
    });
    Object.assign(mockSupabase.state.applications[0], {
      salary: "$130k edited",
      location: null,
      tags: ["backend", "manual"]
    });

    const { body } = await postApplication({
      company: "Granite",
      role: "Engineer",
      url: "https://jobs.example.com/granite/engineer",
      salary: "$100k to $120k",
      location: "New York",
      tags: ["remote", "manual", "fintech"]
    });

    expect(body.deduped).toBe(true);
    expect(body.salary).toBe("$130k edited");
    expect(body.location).toBe("New York");
    expect(body.tags).toEqual(["backend", "manual", "remote", "fintech"]);
  });
});

async function postApplication(payload: Record<string, unknown>) {
  const response = await POST(
    new NextRequest("http://localhost/api/applications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-extension-api-secret": "test-secret"
      },
      body: JSON.stringify(payload)
    })
  );

  return {
    response,
    body: await response.json()
  };
}
