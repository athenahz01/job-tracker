import { beforeEach, describe, expect, it, vi } from "vitest";

const applicationId = "00000000-0000-4000-8000-000000000001";

const mockAnthropic = vi.hoisted(() => ({
  scoreFitWithClaude: vi.fn(),
  tailorApplicationWithClaude: vi.fn(),
  analyzeRequirementsWithClaude: vi.fn(),
  tailorResumeVariantWithClaude: vi.fn()
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
    } as Record<string, unknown> | null,
    inserts: [] as TableWrite[],
    upserts: [] as TableWrite[],
    updates: [] as TableWrite[],
    deletes: [] as TableWrite[]
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
      eq: () => {
        if (table !== "applications") {
          state.updates.push({ table, value });
          return { data: null, error: null };
        }
        return {
          is: async () => {
            state.updates.push({ table, value });
            return { data: null, error: null };
          }
        };
      }
    };
  }

  function createDeleteBuilder(table: string) {
    return {
      eq: (_column: string, value: unknown) => {
        state.deletes.push({ table, value: { id: value } });
        return { data: null, error: null };
      }
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
              ...(state.profile ?? {}),
              ...value,
              id: Number(value.id)
            };
          }
          return { data: value, error: null };
        },
        update: (value: Record<string, unknown>) => createUpdateBuilder(table, value),
        delete: () => createDeleteBuilder(table),
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
  createEducationAction,
  createScreenerAnswerAction,
  createWorkExperienceAction,
  deleteEducationAction,
  deleteScreenerAnswerAction,
  deleteWorkExperienceAction,
  renameCompanyAction,
  saveApplicationProfileAction,
  saveEqualEmploymentAction,
  saveSkillsAction,
  updateEducationAction,
  updateScreenerAnswerAction,
  updateWorkExperienceAction,
  updateApplicationUrlAction,
  updateApplicationRoleAction
} from "../lib/dashboard-actions";
import { requireDashboardAccess } from "../lib/dashboard-auth";
import {
  generateTailoredResumeVariant,
  saveProfileResume,
  scoreApplicationFit,
  scoreApplicationRequirements,
  tailorApplication
} from "../lib/resume-fit";

const mockedRequireDashboardAccess = vi.mocked(requireDashboardAccess);

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
    mockSupabase.state.deletes = [];
    mockedRequireDashboardAccess.mockClear();
    mockAnthropic.scoreFitWithClaude.mockReset();
    mockAnthropic.tailorApplicationWithClaude.mockReset();
    mockAnthropic.analyzeRequirementsWithClaude.mockReset();
    mockAnthropic.tailorResumeVariantWithClaude.mockReset();
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
    formData.set("school", "Rutgers University");
    formData.set("pastCompanies", "Bravo, Cobalt, Bravo");
    formData.set("outreachStage", "to_reach");
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
          school: "Rutgers University",
          past_companies: ["Bravo", "Cobalt"],
          outreach_stage: "to_reach",
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

  it("updates an application posting URL through a gated action", async () => {
    const formData = new FormData();
    formData.set("applicationId", applicationId);
    formData.set("url", "https://jobs.example.com/acme/product-analyst");

    await expect(updateApplicationUrlAction(formData)).rejects.toMatchObject({
      path: `/applications/${applicationId}?status=url_saved`
    });

    expect(mockedRequireDashboardAccess).toHaveBeenCalled();
    expect(mockSupabase.state.updates).toEqual([
      {
        table: "applications",
        value: expect.objectContaining({
          url: "https://jobs.example.com/acme/product-analyst",
          updated_at: expect.any(String)
        })
      }
    ]);
  });

  it("rejects an invalid posting URL without writing", async () => {
    const formData = new FormData();
    formData.set("applicationId", applicationId);
    formData.set("url", "javascript:alert(1)");

    await expect(updateApplicationUrlAction(formData)).rejects.toMatchObject({
      path: `/applications/${applicationId}?status=url_invalid`
    });

    expect(mockedRequireDashboardAccess).toHaveBeenCalled();
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

  it("stores a validated requirement match array", async () => {
    mockAnthropic.analyzeRequirementsWithClaude.mockResolvedValue({
      requirements: [
        {
          requirement: " SQL analytics ",
          status: "met",
          evidence: " Resume names SQL analytics workflows. "
        },
        {
          requirement: "React dashboards",
          status: "partial",
          evidence: "Resume names dashboards but not React."
        },
        {
          requirement: "Python automation",
          status: "missing",
          evidence: "Python is not present in the resume."
        },
        {
          requirement: "React dashboards",
          status: "missing",
          evidence: "Duplicate should be ignored."
        },
        {
          requirement: "Invalid item",
          status: "supported",
          evidence: "Invalid status should be ignored."
        }
      ]
    });

    await expect(scoreApplicationRequirements(applicationId)).resolves.toBe(
      "requirements_saved"
    );

    expect(mockSupabase.state.updates).toEqual([
      {
        table: "applications",
        value: expect.objectContaining({
          requirement_matches: [
            {
              requirement: "SQL analytics",
              status: "met",
              evidence: "Resume names SQL analytics workflows."
            },
            {
              requirement: "React dashboards",
              status: "partial",
              evidence: "Resume names dashboards but not React."
            },
            {
              requirement: "Python automation",
              status: "missing",
              evidence: "Python is not present in the resume."
            }
          ],
          requirements_scored_at: expect.any(String)
        })
      }
    ]);
  });

  it("leaves requirement matches unset for a malformed model response", async () => {
    mockAnthropic.analyzeRequirementsWithClaude.mockResolvedValue({
      requirements: [
        {
          requirement: "Python automation",
          status: "unsupported",
          evidence: "Wrong status."
        }
      ]
    });

    await expect(scoreApplicationRequirements(applicationId)).resolves.toBe(
      "requirements_error"
    );

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
    expect(mockSupabase.state.profile).toEqual(expect.objectContaining({
      id: 1,
      resume_text: "Second resume"
    }));
  });

  it("upserts application profile details through a gated action", async () => {
    const formData = new FormData();
    formData.set("firstName", " Ada ");
    formData.set("lastName", " Lovelace ");
    formData.set("fullName", " Ada Lovelace ");
    formData.set("email", " ada@example.com ");
    formData.set("phone", "555-0100");
    formData.set("location", "New York, NY");
    formData.set("city", "New York");
    formData.set("state", "NY");
    formData.set("country", "United States");
    formData.set("postalCode", "10001");
    formData.set("linkedinUrl", "https://linkedin.com/in/ada");
    formData.set("githubUrl", "https://github.com/ada");
    formData.set("portfolioUrl", "https://ada.example.com/work");
    formData.set("websiteUrl", "https://ada.example.com");
    formData.set("workAuthorization", "Authorized to work in the United States");
    formData.set("yearsExperience", "7");
    formData.set("currentTitle", "Product Engineer");

    await expect(saveApplicationProfileAction(formData)).rejects.toMatchObject({
      path: "/?view=profile&status=application_profile_saved"
    });

    expect(mockedRequireDashboardAccess).toHaveBeenCalled();
    expect(mockSupabase.state.upserts).toEqual([
      {
        table: "profile",
        value: expect.objectContaining({
          id: 1,
          first_name: "Ada",
          last_name: "Lovelace",
          full_name: "Ada Lovelace",
          email: "ada@example.com",
          city: "New York",
          state: "NY",
          country: "United States",
          postal_code: "10001",
          years_experience: "7",
          current_title: "Product Engineer"
        }),
        options: { onConflict: "id" }
      }
    ]);
  });

  it("upserts equal employment answers through a gated action", async () => {
    const formData = new FormData();
    formData.set("workAuthorized", "Yes");
    formData.set("requiresSponsorship", "no");
    formData.set("gender", "Decline to state");
    formData.set("raceEthnicity", "Decline to state");
    formData.set("hispanicLatino", "Decline to state");
    formData.set("veteranStatus", "Not a veteran");
    formData.set("disabilityStatus", "No");
    formData.set("lgbtqStatus", "Decline to state");

    await expect(saveEqualEmploymentAction(formData)).rejects.toMatchObject({
      path: "/?view=profile&status=equal_employment_saved"
    });

    expect(mockedRequireDashboardAccess).toHaveBeenCalled();
    expect(mockSupabase.state.upserts).toEqual([
      {
        table: "profile",
        value: expect.objectContaining({
          id: 1,
          work_authorized: "Yes",
          requires_sponsorship: false,
          gender: "Decline to state",
          veteran_status: "Not a veteran",
          disability_status: "No"
        }),
        options: { onConflict: "id" }
      }
    ]);
  });

  it("upserts skills through a gated action", async () => {
    const formData = new FormData();
    formData.set("skills", " TypeScript, SQL, TypeScript, analytics ");

    await expect(saveSkillsAction(formData)).rejects.toMatchObject({
      path: "/?view=profile&status=skills_saved"
    });

    expect(mockedRequireDashboardAccess).toHaveBeenCalled();
    expect(mockSupabase.state.upserts).toEqual([
      {
        table: "profile",
        value: expect.objectContaining({
          id: 1,
          skills: ["TypeScript", "SQL", "analytics"]
        }),
        options: { onConflict: "id" }
      }
    ]);
  });

  it("creates, updates, and deletes education entries through gated actions", async () => {
    const createForm = new FormData();
    createForm.set("school", "Analytical University");
    createForm.set("degree", "BS");
    createForm.set("fieldOfStudy", "Computer Science");
    createForm.set("startDate", "2018");
    createForm.set("endDate", "2022");
    createForm.set("gpa", "3.8");

    await expect(createEducationAction(createForm)).rejects.toMatchObject({
      path: "/?view=profile&status=education_saved"
    });

    const updateForm = new FormData();
    updateForm.set("educationId", "00000000-0000-4000-8000-000000000003");
    updateForm.set("school", "Analytical University");
    updateForm.set("degree", "MS");
    updateForm.set("fieldOfStudy", "Data Science");

    await expect(updateEducationAction(updateForm)).rejects.toMatchObject({
      path: "/?view=profile&status=education_saved"
    });

    const deleteForm = new FormData();
    deleteForm.set("educationId", "00000000-0000-4000-8000-000000000003");

    await expect(deleteEducationAction(deleteForm)).rejects.toMatchObject({
      path: "/?view=profile&status=education_deleted"
    });

    expect(mockedRequireDashboardAccess).toHaveBeenCalledTimes(3);
    expect(mockSupabase.state.inserts).toEqual([
      {
        table: "education",
        value: expect.objectContaining({
          school: "Analytical University",
          degree: "BS",
          field_of_study: "Computer Science"
        })
      }
    ]);
    expect(mockSupabase.state.updates).toEqual([
      {
        table: "education",
        value: expect.objectContaining({
          degree: "MS",
          field_of_study: "Data Science",
          updated_at: expect.any(String)
        })
      }
    ]);
    expect(mockSupabase.state.deletes).toEqual([
      {
        table: "education",
        value: { id: "00000000-0000-4000-8000-000000000003" }
      }
    ]);
  });

  it("rejects invalid education entries", async () => {
    const formData = new FormData();
    formData.set("startDate", "2018");

    await expect(createEducationAction(formData)).rejects.toMatchObject({
      path: "/?view=profile&status=education_invalid"
    });

    expect(mockedRequireDashboardAccess).toHaveBeenCalled();
    expect(mockSupabase.state.inserts).toEqual([]);
  });

  it("creates, updates, and deletes work entries through gated actions", async () => {
    const createForm = new FormData();
    createForm.set("company", "Acme");
    createForm.set("title", "Product Engineer");
    createForm.set("location", "New York, NY");
    createForm.set("startDate", "2022");
    createForm.set("isCurrent", "on");
    createForm.set("description", "Built analytics workflows.");

    await expect(createWorkExperienceAction(createForm)).rejects.toMatchObject({
      path: "/?view=profile&status=work_saved"
    });

    const updateForm = new FormData();
    updateForm.set("workExperienceId", "00000000-0000-4000-8000-000000000004");
    updateForm.set("company", "Acme");
    updateForm.set("title", "Senior Product Engineer");
    updateForm.set("description", "Led product analytics workflows.");

    await expect(updateWorkExperienceAction(updateForm)).rejects.toMatchObject({
      path: "/?view=profile&status=work_saved"
    });

    const deleteForm = new FormData();
    deleteForm.set("workExperienceId", "00000000-0000-4000-8000-000000000004");

    await expect(deleteWorkExperienceAction(deleteForm)).rejects.toMatchObject({
      path: "/?view=profile&status=work_deleted"
    });

    expect(mockedRequireDashboardAccess).toHaveBeenCalledTimes(3);
    expect(mockSupabase.state.inserts).toEqual([
      {
        table: "work_experience",
        value: expect.objectContaining({
          company: "Acme",
          title: "Product Engineer",
          is_current: true,
          description: "Built analytics workflows."
        })
      }
    ]);
    expect(mockSupabase.state.updates).toEqual([
      {
        table: "work_experience",
        value: expect.objectContaining({
          title: "Senior Product Engineer",
          description: "Led product analytics workflows.",
          updated_at: expect.any(String)
        })
      }
    ]);
    expect(mockSupabase.state.deletes).toEqual([
      {
        table: "work_experience",
        value: { id: "00000000-0000-4000-8000-000000000004" }
      }
    ]);
  });

  it("rejects invalid work entries", async () => {
    const formData = new FormData();
    formData.set("startDate", "2022");

    await expect(createWorkExperienceAction(formData)).rejects.toMatchObject({
      path: "/?view=profile&status=work_invalid"
    });

    expect(mockedRequireDashboardAccess).toHaveBeenCalled();
    expect(mockSupabase.state.inserts).toEqual([]);
  });

  it("creates answer bank entries through a gated action", async () => {
    const formData = new FormData();
    formData.set("question", " Why this company? ");
    formData.set("answer", " I like the product and the customer problem. ");
    formData.set("tags", "motivation, company, motivation");

    await expect(createScreenerAnswerAction(formData)).rejects.toMatchObject({
      path: "/?view=profile&status=answer_saved"
    });

    expect(mockedRequireDashboardAccess).toHaveBeenCalled();
    expect(mockSupabase.state.inserts).toEqual([
      {
        table: "screener_answers",
        value: {
          question: "Why this company?",
          answer: "I like the product and the customer problem.",
          tags: ["motivation", "company"]
        }
      }
    ]);
  });

  it("rejects invalid answer bank creates", async () => {
    const formData = new FormData();
    formData.set("answer", "Missing question.");

    await expect(createScreenerAnswerAction(formData)).rejects.toMatchObject({
      path: "/?view=profile&status=answer_invalid"
    });

    expect(mockedRequireDashboardAccess).toHaveBeenCalled();
    expect(mockSupabase.state.inserts).toEqual([]);
  });

  it("updates answer bank entries through a gated action", async () => {
    const formData = new FormData();
    formData.set("answerId", "00000000-0000-4000-8000-000000000002");
    formData.set("question", "Why are you interested?");
    formData.set("answer", "The work matches my product analytics background.");
    formData.set("tags", "motivation");

    await expect(updateScreenerAnswerAction(formData)).rejects.toMatchObject({
      path: "/?view=profile&status=answer_saved"
    });

    expect(mockedRequireDashboardAccess).toHaveBeenCalled();
    expect(mockSupabase.state.updates).toEqual([
      {
        table: "screener_answers",
        value: expect.objectContaining({
          question: "Why are you interested?",
          answer: "The work matches my product analytics background.",
          tags: ["motivation"],
          updated_at: expect.any(String)
        })
      }
    ]);
  });

  it("deletes answer bank entries through a gated action", async () => {
    const formData = new FormData();
    formData.set("answerId", "00000000-0000-4000-8000-000000000002");

    await expect(deleteScreenerAnswerAction(formData)).rejects.toMatchObject({
      path: "/?view=profile&status=answer_deleted"
    });

    expect(mockedRequireDashboardAccess).toHaveBeenCalled();
    expect(mockSupabase.state.deletes).toEqual([
      {
        table: "screener_answers",
        value: { id: "00000000-0000-4000-8000-000000000002" }
      }
    ]);
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

  it("stores a tailored resume variant without touching the master resume", async () => {
    mockAnthropic.tailorResumeVariantWithClaude.mockResolvedValue(
      " Tailored resume\n\nBuilt SQL dashboards for analytics workflows. "
    );

    await expect(generateTailoredResumeVariant(applicationId)).resolves.toBe(
      "tailored_resume_saved"
    );

    expect(mockSupabase.state.updates).toEqual([
      {
        table: "applications",
        value: expect.objectContaining({
          ai_tailored_resume:
            "Tailored resume\n\nBuilt SQL dashboards for analytics workflows.",
          tailored_resume_at: expect.any(String)
        })
      }
    ]);
    expect(mockSupabase.state.upserts).toEqual([]);
  });
});
