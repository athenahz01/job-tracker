import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAnthropic = vi.hoisted(() => ({
  requestClaudeText: vi.fn()
}));

const mockSupabase = vi.hoisted(() => {
  const state = {
    applications: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        company: "Acme",
        role: "Analyst",
        stage: "Applied",
        kind: "application",
        merged_into_id: null,
        follow_up_on: "2026-06-08",
        next_action: "Send a note",
        last_activity: "2026-06-01T00:00:00.000Z",
        fit_score: 80,
        notes: "Product analytics role focused on dashboards.",
        requirement_matches: [],
        ai_interview_prep: null
      }
    ],
    contacts: [
      {
        id: "00000000-0000-4000-8000-000000000002",
        name: "Riley",
        company: "Acme",
        relationship: "recruiter",
        next_follow_up: "2026-06-08"
      }
    ],
    profile: [
      {
        id: 1,
        resume_text: "Built SQL dashboards and analytics workflows."
      }
    ]
  };

  class Query {
    private rows: Array<Record<string, unknown>>;
    private filters: Array<{ column: string; value: unknown }> = [];

    constructor(rows: Array<Record<string, unknown>>) {
      this.rows = rows;
    }

    select() {
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, value });
      return this;
    }

    is(column: string, value: unknown) {
      this.filters.push({ column, value });
      return this;
    }

    async maybeSingle() {
      const rows = await this.resolve();
      return {
        data: rows.data[0] ?? null,
        error: null
      };
    }

    then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return this.resolve().then(onfulfilled, onrejected);
    }

    private async resolve() {
      return {
        data: this.rows.filter((row) =>
          this.filters.every((filter) => row[filter.column] === filter.value)
        ),
        error: null
      };
    }
  }

  return {
    state,
    createClient: () => ({
      from: (table: string) => {
        if (table === "applications") {
          return new Query(state.applications);
        }
        if (table === "contacts") {
          return new Query(state.contacts);
        }
        if (table === "profile") {
          return new Query(state.profile);
        }
        throw new Error(`Unexpected table ${table}.`);
      }
    })
  };
});

vi.mock("../lib/anthropic", () => mockAnthropic);

vi.mock("../lib/supabase", () => ({
  createSupabaseServerClient: mockSupabase.createClient
}));

vi.mock("../lib/dashboard-auth", () => ({
  requireDashboardAccess: vi.fn()
}));

vi.mock("server-only", () => ({}));

import { askPipelineAssistantAction } from "../lib/copilot-actions";

describe("copilot action", () => {
  beforeEach(() => {
    mockAnthropic.requestClaudeText.mockReset();
    mockAnthropic.requestClaudeText.mockResolvedValue("Follow up with Acme and Riley.");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("builds tracker context and returns Claude text", async () => {
    const result = await askPipelineAssistantAction("What should I follow up on?");

    expect(result).toEqual({
      ok: true,
      answer: "Follow up with Acme and Riley.",
      error: null
    });
    expect(mockAnthropic.requestClaudeText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Acme")
      })
    );
    expect(mockAnthropic.requestClaudeText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Built SQL dashboards")
      })
    );
  });
});
