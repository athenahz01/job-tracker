import { beforeEach, describe, expect, it, vi } from "vitest";

const applicationId = "00000000-0000-4000-8000-000000000001";
const contactId = "00000000-0000-4000-8000-000000000002";

const mockAnthropic = vi.hoisted(() => ({
  requestClaudeText: vi.fn()
}));

const mockSupabase = vi.hoisted(() => {
  const state = {
    applications: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        company: "Acme",
        role: "Product Analyst",
        stage: "Applied",
        url: "https://jobs.example.com/acme/product-analyst",
        last_activity: "2026-06-01T00:00:00.000Z",
        next_action: "Follow up with recruiter",
        follow_up_on: "2026-06-08",
        merged_into_id: null
      }
    ],
    contacts: [
      {
        id: "00000000-0000-4000-8000-000000000002",
        name: "Riley",
        company: "Acme",
        title: "Recruiter",
        relationship: "recruiter",
        school: "Rutgers University",
        past_companies: ["Bravo"],
        outreach_stage: "reached",
        notes: "Met at a product analytics event.",
        application_id: "00000000-0000-4000-8000-000000000001"
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
      return {
        data: this.rows.find((row) =>
          this.filters.every((filter) => row[filter.column] === filter.value)
        ) ?? null,
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

import {
  draftApplicationFollowUpAction,
  draftContactOutreachAction,
  draftNetworkingMessageAction
} from "../lib/ai-draft-actions";

describe("AI draft actions", () => {
  beforeEach(() => {
    mockAnthropic.requestClaudeText.mockReset();
    mockAnthropic.requestClaudeText.mockResolvedValue("Hi Riley, just checking in.");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("returns a follow-up draft from Claude", async () => {
    const formData = new FormData();
    formData.set("applicationId", applicationId);

    const result = await draftApplicationFollowUpAction(
      { ok: false, text: "", error: null },
      formData
    );

    expect(result).toEqual({
      ok: true,
      text: "Hi Riley, just checking in.",
      error: null
    });
    expect(mockAnthropic.requestClaudeText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Company: Acme")
      })
    );
  });

  it("returns a contact outreach draft from Claude", async () => {
    const formData = new FormData();
    formData.set("contactId", contactId);

    const result = await draftContactOutreachAction(
      { ok: false, text: "", error: null },
      formData
    );

    expect(result.ok).toBe(true);
    expect(result.text).toBe("Hi Riley, just checking in.");
    expect(mockAnthropic.requestClaudeText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Contact name: Riley")
      })
    );
  });

  it("returns a referral draft from Claude for a contact and target application", async () => {
    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("applicationId", applicationId);
    formData.set("variant", "referral_request");

    const result = await draftNetworkingMessageAction(
      { ok: false, text: "", error: null },
      formData
    );

    expect(result.ok).toBe(true);
    expect(result.text).toBe("Hi Riley, just checking in.");
    expect(mockAnthropic.requestClaudeText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Draft a referral request message")
      })
    );
    expect(mockAnthropic.requestClaudeText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Target application: Acme, Product Analyst, Applied")
      })
    );
  });
});
