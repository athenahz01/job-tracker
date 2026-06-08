import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSupabase = vi.hoisted(() => {
  const state = {
    inserts: [] as Array<{ table: string; value: Record<string, unknown> }>
  };

  return {
    state,
    createClient: () => ({
      from: (table: string) => ({
        insert: async (value: Record<string, unknown>) => {
          state.inserts.push({ table, value });
          return { data: value, error: null };
        }
      })
    })
  };
});

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

import { createContactAction } from "../lib/dashboard-actions";

describe("dashboard actions", () => {
  beforeEach(() => {
    mockSupabase.state.inserts = [];
  });

  it("creates a contact linked to an application", async () => {
    const applicationId = "00000000-0000-4000-8000-000000000001";
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
});
