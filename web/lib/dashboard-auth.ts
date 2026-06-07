import "server-only";

import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const dashboardSessionCookie = "job_tracker_dashboard";

export function dashboardPasswordIsSet() {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}

export function dashboardSessionValue() {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return "";
  }

  return createHash("sha256").update(`job-tracker:${password}`).digest("base64url");
}

export async function hasDashboardAccess() {
  const expected = dashboardSessionValue();
  if (!expected) {
    return true;
  }

  const cookieStore = await cookies();
  const actual = cookieStore.get(dashboardSessionCookie)?.value;
  if (!actual) {
    return false;
  }

  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function requireDashboardAccess() {
  if (!(await hasDashboardAccess())) {
    throw new Error("Dashboard access required.");
  }
}
