import { NextRequest, NextResponse } from "next/server";

const cookieName = "job_tracker_dashboard";

export async function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/applications") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/posting") ||
    pathname.startsWith("/api/score")
  ) {
    return NextResponse.next();
  }

  const expected = await sessionValue(password);
  const actual = request.cookies.get(cookieName)?.value;

  if (actual === expected) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

async function sessionValue(password: string) {
  const bytes = new TextEncoder().encode(`job-tracker:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) {
    value += String.fromCharCode(byte);
  }

  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
