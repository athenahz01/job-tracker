"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireDashboardAccess } from "./dashboard-auth";
import { createSupabaseServerClient } from "./supabase";
import { Stage, stages } from "./stages";

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

function revalidateApplicationViews(id: string) {
  revalidatePath("/");
  revalidatePath(`/applications/${id}`);
}

function redirectWithStatus(id: string, status: string): never {
  const target = isUuid(id) ? `/applications/${id}` : "/";
  redirect(`${target}?status=${encodeURIComponent(status)}`);
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
