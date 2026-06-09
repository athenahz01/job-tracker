import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { proxy } from "../proxy";

describe("proxy", () => {
  const originalPassword = process.env.DASHBOARD_PASSWORD;

  afterEach(() => {
    if (originalPassword === undefined) {
      delete process.env.DASHBOARD_PASSWORD;
    } else {
      process.env.DASHBOARD_PASSWORD = originalPassword;
    }
  });

  it("allows extension-authenticated API routes through the dashboard gate", async () => {
    process.env.DASHBOARD_PASSWORD = "passphrase";

    await expectProxyAllowed("/api/posting");
    await expectProxyAllowed("/api/score");
  });

  it("still redirects dashboard pages to login", async () => {
    process.env.DASHBOARD_PASSWORD = "passphrase";

    const response = await proxy(new NextRequest("http://localhost/applications/app-1"));

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.headers.get("location")).toContain("/login");
  });
});

async function expectProxyAllowed(pathname: string) {
  const response = await proxy(new NextRequest(`http://localhost${pathname}`));

  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
}
