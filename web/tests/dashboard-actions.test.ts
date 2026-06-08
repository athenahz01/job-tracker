import { beforeEach, describe, expect, it, vi } from "vitest";

const applicationId = "00000000-0000-4000-8000-000000000001";

const mockAnthropic = vi.hoisted(() => ({
  scoreFitWithClaude: vi.fn(),
  tailorApplicationWithClaude: vi.fn()
}));

const mockSupabase = vi.hoisted(() => {
  type TableWrite = {
    table: string;
    value: Record<string, unknown>;
    options?: Record<string, unknown>;
  };

  const state = {
    application: {
      id: "00000000-0000-4000-8000-000000000001",
      company: "Acme",
      role: "Product Analyst",
      notes: "React, SQL, dashboard analytics, stakeholder reporting"
    },
    profile: {
      id: 1,
      resume_text: "Built TypeScript dashboards with SQL and analytics workflows."
    } as { id: number; resume_text: string | null } | null,
    inserts: [] as TableWrite[],
    upserts: [] as TableWrite[],
    updates: [] as TableWrite[]
  };

  function createSelectBuilder(table: string) {
    return {
      eq: () => createSelectBuilder(table),
      is: () => createSelectBuilder(table),
      maybeSingle: async () => {
        if (table === "applications") {
          return { data: state.application, error: null };
        }
        if (table === "profile") {
          return { data: state.profile, error: null };
        }
        return { data: null, error: null };
      }
    };
  }

  function createUpdateBuilder(table: string, value: Record<string, unknown>) {
    return {
      eq: () => ({
        is: async () => {
          state.updates.push({ table, value });
          return { data: null, error: null };
        }
      })
    };
  }

  return {
    state,
    createClient: () => ({
      from: (table: string) => ({
        insert: async (value: Record<string, unknown>) => {
          state.inserts.push({ table, value });
          return { data: value, error: null };
        },
        upsert: async (value: Record<string, unknown>, options?: Record<string, unknown>) => {
          state.upserts.push({ table, value, options });
          if (table === "profile") {
            state.profile = {
              id: Number(value.id),
              resume_text: (value.resume_text as string | null) ?? null
            };
          }
          return { data: value, error: null };
        },
        update: (value: Record<string, unknown>) => createUpdateBuilder(table, value),
        select: () => createSelectBuilder(table)
      })
    })
  };
});

vi.mock("../lib/anthropic", () => mockAnthropic);

vi.mock("server-only", () => ({}));

vi.mock("../lib/supabase", () => ({
  createSupabaseServerClient: mockSupabase.createClient
}));

vi.mock("../lib/dashboard-auth", () => ({
  requireDashboardAccess: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { path });
  }
}));

import {
  createContactAction,
  renameCompanyAction,
  updateApplicationRoleAction
} from "../lib/dashboard-actions";
import {
  saveProfileResume,
  scoreApplicationFit,
  tailorApplication
} from "../lib/resume-fit";

describe("dashboard actions", () => {
  beforeEach(() => {
    mockSupabase.state.application = {
      id: applicationId,
      company: "Acme",
      role: "Product Analyst",
      notes: "React, SQL, dashboard analytics, stakeholder reporting"
    };
    mockSupabase.state.profile = {
      id: 1,
      resume_text: "Built TypeScript dashboards with SQL and analytics workflows."
    };
    mockSupabase.state.inserts = [];
    mockSupabase.state.upserts = [];
    mockSupabase.state.updates = [];
    mockAnthropic.scoreFitWithClaude.mockReset();
    mockAnthropic.tailorApplicationWithClaude.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("creates a contact linked to an application", async () => {
    const formData = new FormData();
    formData.set("returnTo", "/?view=network");
    formData.set("name", "Riley Recruiter");
    formData.set("company", "Acme");
    formData.set("title", "Recruiter");
    formData.set("email", "riley@example.com");
    formData.set("relationship", "recruiter");
    formData.set("applicationId", applicationId);
    formData.set("nextFollowUp", "2026-06-08");

    await expect(createContactAction(formData)).rejects.toMatchObject({
      path: "/?view=network&status=contact_saved"
    });

    expect(mockSupabase.state.inserts).toEqual([
      {
        table: "contacts",
        value: expect.objectContaining({
          name: "Riley Recruiter",
          company: "Acme",
          title: "Recruiter",
          email: "riley@example.com",
          relationship: "recruiter",
          application_id: applicationId,
          next_follow_up: "2026-06-08"
        })
      }
    ]);
  });

  it("renames a company and updates the normalized company", async () => {
    const formData = new FormData();
    formData.set("applicationId", applicationId);
    formData.set("company", "Tradeweb Markets LLC");

    await expect(renameCompanyAction(formData)).rejects.toMatchObject({
      path: `/applications/${applicationId}?status=company_saved`
    });

    expect(mockSupabase.state.updates).toEqual([
      {
        table: "applications",
        value: expect.objectContaining({
          company: "Tradeweb Markets LLC",
          normalized_company: "tradeweb markets"
        })
      }
    ]);
  });

  it("updates an application role", async () => {
    const formData = new FormData();
    formData.set("applicationId", applicationId);
    formData.set("role", "Senior Product Manager");

    await expect(updateApplicationRoleAction(formData)).rejects.toMatchObject({
      path: `/applications/${applicationId}?status=role_saved`
    });

    expect(mockSupabase.state.updates).toEqual([
      {
        table: "applications",
        value: expect.objectContaining({
          role: "Senior Product Manager",
          updated_at: expect.any(String)
        })
      }
    ]);
  });

  it("rejects an invalid role update id", async () => {
    const formData = new FormData();
    formData.set("applicationId", "not-a-real-id");
    formData.set("role", "Senior Product Manager");

    await expect(updateApplicationRoleAction(formData)).rejects.toMatchObject({
      path: "/?status=invalid"
    });

    expect(mockSupabase.state.updates).toEqual([]);
  });

  it("stores a clamped score and cleaned keywords", async () => {
    mockAnthropic.scoreFitWithClaude.mockResolvedValue({
      fit_score: 135,
      fit_summary: " Strong fit with one gap. ",
      missing_keywords: [" React ", "react", "", "Stakeholder management", 42]
    });

    await expect(scoreApplicationFit(applicationId)).resolves.toBe("fit_scored");

    expect(mockSupabase.state.updates).toEqual([
      {
        table: "applications",
        value: expect.objectContaining({
          fit_score: 100,
          fit_summary: "Strong fit with one gap.",
          missing_keywords: ["React", "Stakeholder management"],
          scored_at: expect.any(String)
        })
      }
    ]);
  });

  it("leaves score unset for a malformed model response", async () => {
    mockAnthropic.scoreFitWithClaude.mockResolvedValue({
      fit_summary: "Missing required fields."
    });

    await expect(scoreApplicationFit(applicationId)).resolves.toBe("fit_error");

    expect(mockSupabase.state.updates).toEqual([]);
  });

  it("upserts the single profile row for the resume", async () => {
    await expect(saveProfileResume(" First resume ")).resolves.toBe("profile_saved");
    await expect(saveProfileResume(" Second resume ")).resolves.toBe("profile_saved");

    expect(mockSupabase.state.upserts).toEqual([
      {
        table: "profile",
        value: expect.objectContaining({ id: 1, resume_text: "First resume" }),
        options: { onConflict: "id" }
      },
      {
        table: "profile",
        value: expect.objectContaining({ id: 1, resume_text: "Second resume" }),
        options: { onConflict: "id" }
      }
    ]);
    expect(mockSupabase.state.profile).toEqual({
      id: 1,
      resume_text: "Second resume"
    });
  });

  it("stores tailoring bullets and a cover letter draft", async () => {
    mockAnthropic.tailorApplicationWithClaude.mockResolvedValue({
      ai_tailored_bullets: [" Built SQL dashboards ", "Built SQL dashboards", "Led analytics reviews"],
      ai_cover_letter: " Hello Acme,\n\nI am excited to apply. "
    });

    await expect(tailorApplication(applicationId)).resolves.toBe("tailor_saved");

    expect(mockSupabase.state.updates).toEqual([
      {
        table: "applications",
        value: expect.objectContaining({
          ai_tailored_bullets: ["Built SQL dashboards", "Led analytics reviews"],
          ai_cover_letter: "Hello Acme,\n\nI am excited to apply.",
          tailored_at: expect.any(String)
        })
      }
    ]);
  });
});
