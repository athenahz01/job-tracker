"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  dashboardSessionCookie,
  dashboardSessionValue
} from "../../lib/dashboard-auth";

export async function loginAction(formData: FormData) {
  const password = process.env.DASHBOARD_PASSWORD;
  const next = cleanNextPath(formData.get("next"));

  if (!password) {
    redirect(next);
  }

  const entered = formData.get("password");
  if (typeof entered !== "string" || entered !== password) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(dashboardSessionCookie, dashboardSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  redirect(next);
}

function cleanNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
