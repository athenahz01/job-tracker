"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizeCompanyName } from "./company";
import { requireDashboardAccess } from "./dashboard-auth";
import { isOutreachStage } from "./networking";
import {
  generateTailoredResumeVariant,
  saveProfileResume,
  scoreApplicationFit,
  scoreApplicationRequirements,
  tailorApplication
} from "./resume-fit";
import { createSupabaseServerClient } from "./supabase";
import { type Stage, stages } from "./stages";
import { isPriority, isRelationship } from "./tracker";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function setStageAction(formData: FormData) {
  await requireDashboardAccess();

  const id = readString(formData.get("applicationId"));
  const stage = readString(formData.get("stage"));
  if (!isUuid(id) || !isStage(stage)) {
    redirectWithStatus(id, "invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("applications")
    .update({ stage, stage_locked: true })
    .eq("id", id)
    .is("merged_into_id", null);

  if (error) {
    redirectWithStatus(id, "stage_error");
  }

  revalidateApplicationViews(id);
  redirectWithStatus(id, "stage_saved");
}

export async function clearStageLockAction(formData: FormData) {
  await requireDashboardAccess();

  const id = readString(formData.get("applicationId"));
  if (!isUuid(id)) {
    redirectWithStatus(id, "invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("applications")
    .update({ stage_locked: false })
    .eq("id", id)
    .is("merged_into_id", null);

  if (error) {
    redirectWithStatus(id, "lock_error");
  }

  revalidateApplicationViews(id);
  redirectWithStatus(id, "lock_cleared");
}

export async function mergeOrphanAction(formData: FormData) {
  await requireDashboardAccess();

  const orphanId = readString(formData.get("orphanId"));
  const targetId = readString(formData.get("targetId"));
  if (!isUuid(orphanId) || !isUuid(targetId) || orphanId === targetId) {
    redirectWithStatus(orphanId, "invalid");
  }

  const supabase = createSupabaseServerClient();
  const [orphanResponse, targetResponse] = await Promise.all([
    supabase
      .from("applications")
      .select("id, is_orphan, last_activity, kind")
      .eq("id", orphanId)
      .eq("kind", "application")
      .is("merged_into_id", null)
      .maybeSingle(),
    supabase
      .from("applications")
      .select("id, last_activity, kind")
      .eq("id", targetId)
      .eq("kind", "application")
      .is("merged_into_id", null)
      .maybeSingle()
  ]);

  const orphan = orphanResponse.data;
  const target = targetResponse.data;
  if (
    orphanResponse.error ||
    targetResponse.error ||
    !orphan ||
    !target ||
    !orphan.is_orphan
  ) {
    redirectWithStatus(orphanId, "merge_error");
  }

  const mergedLastActivity = laterTimestamp(
    orphan.last_activity as string | null,
    target.last_activity as string | null
  );

  const eventUpdate = await supabase
    .from("email_events")
    .update({ application_id: targetId })
    .eq("application_id", orphanId);
  if (eventUpdate.error) {
    redirectWithStatus(orphanId, "merge_error");
  }

  const orphanUpdate = await supabase
    .from("applications")
    .update({ merged_into_id: targetId })
    .eq("id", orphanId);
  if (orphanUpdate.error) {
    redirectWithStatus(orphanId, "merge_error");
  }

  if (mergedLastActivity) {
    const targetUpdate = await supabase
      .from("applications")
      .update({ last_activity: mergedLastActivity })
      .eq("id", targetId);
    if (targetUpdate.error) {
      redirectWithStatus(orphanId, "merge_error");
    }
  }

  revalidatePath("/");
  revalidatePath(`/applications/${orphanId}`);
  revalidatePath(`/applications/${targetId}`);
  redirect(`/applications/${targetId}?status=merged`);
}

export async function updateApplicationTrackerFieldsAction(formData: FormData) {
  await requireDashboardAccess();

  const id = readString(formData.get("applicationId"));
  if (!isUuid(id)) {
    redirectWithStatus(id, "invalid");
  }

  const priority = optionalPriority(readString(formData.get("priority")));
  const update = {
    next_action: cleanOptionalText(formData.get("nextAction"), 500),
    follow_up_on: cleanOptionalDate(formData.get("followUpOn")),
    salary: cleanOptionalText(formData.get("salary"), 160),
    location: cleanOptionalText(formData.get("location"), 180),
    deadline: cleanOptionalDate(formData.get("deadline")),
    priority,
    tags: parseTags(formData.get("tags")),
    resume_version: cleanOptionalText(formData.get("resumeVersion"), 160),
    notes: cleanOptionalText(formData.get("notes"), 12000),
    updated_at: new Date().toISOString()
  };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("applications")
    .update(update)
    .eq("id", id)
    .is("merged_into_id", null);

  if (error) {
    redirectWithStatus(id, "tracker_error");
  }

  revalidateApplicationViews(id);
  redirectWithStatus(id, "tracker_saved");
}

export async function renameCompanyAction(formData: FormData) {
  await requireDashboardAccess();

  const id = readString(formData.get("applicationId"));
  const company = cleanRequiredText(formData.get("company"), 180);
  if (!isUuid(id) || !company) {
    redirectWithStatus(id, "invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("applications")
    .update({
      company,
      normalized_company: normalizeCompanyName(company),
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .is("merged_into_id", null);

  if (error) {
    redirectWithStatus(id, "company_error");
  }

  revalidateApplicationViews(id);
  redirectWithStatus(id, "company_saved");
}

export async function updateApplicationRoleAction(formData: FormData) {
  await requireDashboardAccess();

  const id = readString(formData.get("applicationId"));
  if (!isUuid(id)) {
    redirectWithStatus(id, "invalid");
  }

  const role = cleanOptionalText(formData.get("role"), 220);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("applications")
    .update({
      role,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .is("merged_into_id", null);

  if (error) {
    redirectWithStatus(id, "role_error");
  }

  revalidateApplicationViews(id);
  redirectWithStatus(id, "role_saved");
}

export async function updateApplicationUrlAction(formData: FormData) {
  await requireDashboardAccess();

  const id = readString(formData.get("applicationId"));
  if (!isUuid(id)) {
    redirectWithStatus(id, "invalid");
  }

  const url = cleanOptionalUrl(formData.get("url"));
  if (url === "invalid") {
    redirectWithStatus(id, "url_invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("applications")
    .update({
      url,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .is("merged_into_id", null);

  if (error) {
    redirectWithStatus(id, "url_error");
  }

  revalidateApplicationViews(id);
  redirectWithStatus(id, "url_saved");
}

export async function saveProfileAction(formData: FormData) {
  const status = await saveProfileResume(readString(formData.get("resumeText")));

  revalidatePath("/");
  redirect(`/?view=profile&status=${encodeURIComponent(status)}`);
}

export async function saveApplicationProfileAction(formData: FormData) {
  await requireDashboardAccess();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("profile").upsert(
    {
      id: 1,
      first_name: cleanOptionalText(formData.get("firstName"), 120),
      last_name: cleanOptionalText(formData.get("lastName"), 120),
      full_name: cleanOptionalText(formData.get("fullName"), 180),
      email: cleanOptionalText(formData.get("email"), 240),
      phone: cleanOptionalText(formData.get("phone"), 80),
      location: cleanOptionalText(formData.get("location"), 180),
      city: cleanOptionalText(formData.get("city"), 120),
      state: cleanOptionalText(formData.get("state"), 120),
      country: cleanOptionalText(formData.get("country"), 120),
      postal_code: cleanOptionalText(formData.get("postalCode"), 40),
      linkedin_url: cleanOptionalText(formData.get("linkedinUrl"), 500),
      github_url: cleanOptionalText(formData.get("githubUrl"), 500),
      portfolio_url: cleanOptionalText(formData.get("portfolioUrl"), 500),
      website_url: cleanOptionalText(formData.get("websiteUrl"), 500),
      work_authorization: cleanOptionalText(formData.get("workAuthorization"), 500),
      years_experience: cleanOptionalText(formData.get("yearsExperience"), 80),
      current_title: cleanOptionalText(formData.get("currentTitle"), 180),
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("Could not save application profile.");
    revalidatePath("/");
    redirect("/?view=profile&status=application_profile_error");
  }

  revalidatePath("/");
  redirect("/?view=profile&status=application_profile_saved");
}

export async function saveEqualEmploymentAction(formData: FormData) {
  await requireDashboardAccess();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("profile").upsert(
    {
      id: 1,
      work_authorized: cleanOptionalText(formData.get("workAuthorized"), 120),
      requires_sponsorship: parseOptionalBoolean(formData.get("requiresSponsorship")),
      gender: cleanOptionalText(formData.get("gender"), 180),
      race_ethnicity: cleanOptionalText(formData.get("raceEthnicity"), 240),
      hispanic_latino: cleanOptionalText(formData.get("hispanicLatino"), 180),
      veteran_status: cleanOptionalText(formData.get("veteranStatus"), 180),
      disability_status: cleanOptionalText(formData.get("disabilityStatus"), 180),
      lgbtq_status: cleanOptionalText(formData.get("lgbtqStatus"), 180),
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("Could not save equal employment profile.");
    revalidatePath("/");
    redirect("/?view=profile&status=equal_employment_error");
  }

  revalidatePath("/");
  redirect("/?view=profile&status=equal_employment_saved");
}

export async function saveSkillsAction(formData: FormData) {
  await requireDashboardAccess();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("profile").upsert(
    {
      id: 1,
      skills: parseTags(formData.get("skills")),
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("Could not save profile skills.");
    revalidatePath("/");
    redirect("/?view=profile&status=skills_error");
  }

  revalidatePath("/");
  redirect("/?view=profile&status=skills_saved");
}

export async function createEducationAction(formData: FormData) {
  await requireDashboardAccess();

  const payload = readEducationPayload(formData);
  if (!educationHasContent(payload)) {
    redirect("/?view=profile&status=education_invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("education").insert(payload);

  if (error) {
    console.error("Could not create education entry.");
    redirect("/?view=profile&status=education_error");
  }

  revalidatePath("/");
  redirect("/?view=profile&status=education_saved");
}

export async function updateEducationAction(formData: FormData) {
  await requireDashboardAccess();

  const educationId = readString(formData.get("educationId"));
  const payload = readEducationPayload(formData);
  if (!isUuid(educationId) || !educationHasContent(payload)) {
    redirect("/?view=profile&status=education_invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("education")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", educationId);

  if (error) {
    console.error("Could not update education entry.");
    redirect("/?view=profile&status=education_error");
  }

  revalidatePath("/");
  redirect("/?view=profile&status=education_saved");
}

export async function deleteEducationAction(formData: FormData) {
  await requireDashboardAccess();

  const educationId = readString(formData.get("educationId"));
  if (!isUuid(educationId)) {
    redirect("/?view=profile&status=education_invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("education").delete().eq("id", educationId);

  if (error) {
    console.error("Could not delete education entry.");
    redirect("/?view=profile&status=education_error");
  }

  revalidatePath("/");
  redirect("/?view=profile&status=education_deleted");
}

export async function createWorkExperienceAction(formData: FormData) {
  await requireDashboardAccess();

  const payload = readWorkExperiencePayload(formData);
  if (!workExperienceHasContent(payload)) {
    redirect("/?view=profile&status=work_invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("work_experience").insert(payload);

  if (error) {
    console.error("Could not create work experience entry.");
    redirect("/?view=profile&status=work_error");
  }

  revalidatePath("/");
  redirect("/?view=profile&status=work_saved");
}

export async function updateWorkExperienceAction(formData: FormData) {
  await requireDashboardAccess();

  const workExperienceId = readString(formData.get("workExperienceId"));
  const payload = readWorkExperiencePayload(formData);
  if (!isUuid(workExperienceId) || !workExperienceHasContent(payload)) {
    redirect("/?view=profile&status=work_invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("work_experience")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", workExperienceId);

  if (error) {
    console.error("Could not update work experience entry.");
    redirect("/?view=profile&status=work_error");
  }

  revalidatePath("/");
  redirect("/?view=profile&status=work_saved");
}

export async function deleteWorkExperienceAction(formData: FormData) {
  await requireDashboardAccess();

  const workExperienceId = readString(formData.get("workExperienceId"));
  if (!isUuid(workExperienceId)) {
    redirect("/?view=profile&status=work_invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("work_experience").delete().eq("id", workExperienceId);

  if (error) {
    console.error("Could not delete work experience entry.");
    redirect("/?view=profile&status=work_error");
  }

  revalidatePath("/");
  redirect("/?view=profile&status=work_deleted");
}

export async function createScreenerAnswerAction(formData: FormData) {
  await requireDashboardAccess();

  const payload = readScreenerAnswerPayload(formData);
  if (!payload.question || !payload.answer) {
    redirect("/?view=profile&status=answer_invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("screener_answers").insert(payload);

  if (error) {
    console.error("Could not create screener answer.");
    redirect("/?view=profile&status=answer_error");
  }

  revalidatePath("/");
  redirect("/?view=profile&status=answer_saved");
}

export async function updateScreenerAnswerAction(formData: FormData) {
  await requireDashboardAccess();

  const answerId = readString(formData.get("answerId"));
  const payload = readScreenerAnswerPayload(formData);
  if (!isUuid(answerId) || !payload.question || !payload.answer) {
    redirect("/?view=profile&status=answer_invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("screener_answers")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", answerId);

  if (error) {
    console.error("Could not update screener answer.");
    redirect("/?view=profile&status=answer_error");
  }

  revalidatePath("/");
  redirect("/?view=profile&status=answer_saved");
}

export async function deleteScreenerAnswerAction(formData: FormData) {
  await requireDashboardAccess();

  const answerId = readString(formData.get("answerId"));
  if (!isUuid(answerId)) {
    redirect("/?view=profile&status=answer_invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("screener_answers").delete().eq("id", answerId);

  if (error) {
    console.error("Could not delete screener answer.");
    redirect("/?view=profile&status=answer_error");
  }

  revalidatePath("/");
  redirect("/?view=profile&status=answer_deleted");
}

export async function scoreApplicationFitAction(formData: FormData) {
  const id = readString(formData.get("applicationId"));
  const status = await scoreApplicationFit(id);

  if (status === "fit_scored") {
    revalidateApplicationViews(id);
  }
  redirectWithStatus(id, status);
}

export async function scoreApplicationRequirementsAction(formData: FormData) {
  const id = readString(formData.get("applicationId"));
  const status = await scoreApplicationRequirements(id);

  if (status === "requirements_saved") {
    revalidateApplicationViews(id);
  }
  redirectWithStatus(id, status);
}

export async function tailorApplicationAction(formData: FormData) {
  const id = readString(formData.get("applicationId"));
  const status = await tailorApplication(id);

  if (status === "tailor_saved") {
    revalidateApplicationViews(id);
  }
  redirectWithStatus(id, status);
}

export async function generateTailoredResumeAction(formData: FormData) {
  const id = readString(formData.get("applicationId"));
  const status = await generateTailoredResumeVariant(id);

  if (status === "tailored_resume_saved") {
    revalidateApplicationViews(id);
  }
  redirectWithStatus(id, status);
}

export async function createContactAction(formData: FormData) {
  await requireDashboardAccess();

  const returnTo = cleanReturnTo(formData.get("returnTo"));
  const contact = readContactPayload(formData);
  if (!contact.name) {
    redirectWithReturnStatus(returnTo, "contact_invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("contacts").insert(contact);

  if (error) {
    redirectWithReturnStatus(returnTo, "contact_error");
  }

  revalidateContactViews(contact.application_id);
  redirectWithReturnStatus(returnTo, "contact_saved");
}

export async function updateContactAction(formData: FormData) {
  await requireDashboardAccess();

  const returnTo = cleanReturnTo(formData.get("returnTo"));
  const id = readString(formData.get("contactId"));
  if (!isUuid(id)) {
    redirectWithReturnStatus(returnTo, "contact_invalid");
  }

  const contact = readContactPayload(formData);
  if (!contact.name) {
    redirectWithReturnStatus(returnTo, "contact_invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("contacts")
    .update({ ...contact, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    redirectWithReturnStatus(returnTo, "contact_error");
  }

  revalidateContactViews(contact.application_id);
  redirectWithReturnStatus(returnTo, "contact_saved");
}

export async function deleteContactAction(formData: FormData) {
  await requireDashboardAccess();

  const returnTo = cleanReturnTo(formData.get("returnTo"));
  const id = readString(formData.get("contactId"));
  const applicationId = optionalUuid(readString(formData.get("applicationId")));
  if (!isUuid(id)) {
    redirectWithReturnStatus(returnTo, "contact_invalid");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);

  if (error) {
    redirectWithReturnStatus(returnTo, "contact_error");
  }

  revalidateContactViews(applicationId);
  redirectWithReturnStatus(returnTo, "contact_deleted");
}

function revalidateApplicationViews(id: string) {
  revalidatePath("/");
  revalidatePath(`/applications/${id}`);
}

function revalidateContactViews(applicationId: string | null) {
  revalidatePath("/");
  if (applicationId) {
    revalidatePath(`/applications/${applicationId}`);
  }
}

function redirectWithStatus(id: string, status: string): never {
  const target = isUuid(id) ? `/applications/${id}` : "/";
  redirect(`${target}?status=${encodeURIComponent(status)}`);
}

function redirectWithReturnStatus(returnTo: string, status: string): never {
  redirect(appendStatus(returnTo, status));
}

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function isUuid(value: string) {
  return uuidPattern.test(value);
}

function isStage(value: string): value is Stage {
  return stages.includes(value as Stage);
}

function readContactPayload(formData: FormData) {
  const applicationId = optionalUuid(readString(formData.get("applicationId")));
  return {
    name: cleanRequiredText(formData.get("name"), 180),
    company: cleanOptionalText(formData.get("company"), 180),
    title: cleanOptionalText(formData.get("title"), 180),
    email: cleanOptionalText(formData.get("email"), 240),
    linkedin_url: cleanOptionalText(formData.get("linkedinUrl"), 500),
    relationship: optionalRelationship(readString(formData.get("relationship"))),
    school: cleanOptionalText(formData.get("school"), 240),
    past_companies: parseTags(formData.get("pastCompanies")),
    outreach_stage: optionalOutreachStage(readString(formData.get("outreachStage"))),
    application_id: applicationId,
    notes: cleanOptionalText(formData.get("notes"), 4000),
    last_contacted: cleanOptionalDate(formData.get("lastContacted")),
    next_follow_up: cleanOptionalDate(formData.get("nextFollowUp"))
  };
}

function readScreenerAnswerPayload(formData: FormData) {
  return {
    question: cleanRequiredText(formData.get("question"), 1000),
    answer: cleanRequiredText(formData.get("answer"), 8000),
    tags: parseTags(formData.get("tags"))
  };
}

function readEducationPayload(formData: FormData) {
  return {
    school: cleanOptionalText(formData.get("school"), 240),
    degree: cleanOptionalText(formData.get("degree"), 180),
    field_of_study: cleanOptionalText(formData.get("fieldOfStudy"), 180),
    start_date: cleanOptionalText(formData.get("startDate"), 80),
    end_date: cleanOptionalText(formData.get("endDate"), 80),
    gpa: cleanOptionalText(formData.get("gpa"), 40),
    sort_order: parseSortOrder(formData.get("sortOrder"))
  };
}

function readWorkExperiencePayload(formData: FormData) {
  return {
    company: cleanOptionalText(formData.get("company"), 180),
    title: cleanOptionalText(formData.get("title"), 180),
    location: cleanOptionalText(formData.get("location"), 180),
    start_date: cleanOptionalText(formData.get("startDate"), 80),
    end_date: cleanOptionalText(formData.get("endDate"), 80),
    is_current: formData.get("isCurrent") === "on",
    description: cleanOptionalText(formData.get("description"), 8000),
    sort_order: parseSortOrder(formData.get("sortOrder"))
  };
}

function educationHasContent(payload: ReturnType<typeof readEducationPayload>) {
  return Boolean(payload.school || payload.degree || payload.field_of_study);
}

function workExperienceHasContent(payload: ReturnType<typeof readWorkExperiencePayload>) {
  return Boolean(payload.company || payload.title || payload.description);
}

function cleanRequiredText(value: FormDataEntryValue | null, maxLength: number) {
  return cleanText(value, maxLength) ?? "";
}

function cleanOptionalText(value: FormDataEntryValue | null, maxLength: number) {
  return cleanText(value, maxLength);
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : null;
}

function cleanOptionalUrl(value: FormDataEntryValue | null) {
  const text = cleanText(value, 2000);
  if (!text) {
    return null;
  }

  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "invalid";
  } catch {
    return "invalid";
  }
}

function cleanOptionalDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function parseTags(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.slice(0, 40))
    )
  ).slice(0, 20);
}

function parseOptionalBoolean(value: FormDataEntryValue | null) {
  if (value === "yes" || value === "true" || value === "on") {
    return true;
  }
  if (value === "no" || value === "false") {
    return false;
  }
  return null;
}

function parseSortOrder(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function optionalPriority(value: string) {
  return isPriority(value) ? value : null;
}

function optionalRelationship(value: string) {
  return isRelationship(value) ? value : null;
}

function optionalOutreachStage(value: string) {
  return isOutreachStage(value) ? value : null;
}

function optionalUuid(value: string) {
  return isUuid(value) ? value : null;
}

function cleanReturnTo(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function appendStatus(path: string, status: string) {
  const [baseAndQuery, hash = ""] = path.split("#");
  const separator = baseAndQuery.includes("?") ? "&" : "?";
  return `${baseAndQuery}${separator}status=${encodeURIComponent(status)}${hash ? `#${hash}` : ""}`;
}

function laterTimestamp(first: string | null, second: string | null) {
  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }

  const firstTime = Date.parse(first);
  const secondTime = Date.parse(second);
  if (Number.isNaN(firstTime)) {
    return second;
  }
  if (Number.isNaN(secondTime)) {
    return first;
  }

  return firstTime >= secondTime ? first : second;
}
