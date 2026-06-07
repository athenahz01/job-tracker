import { redirect } from "next/navigation";

import { hasDashboardAccess } from "../../lib/dashboard-auth";
import { loginAction } from "./actions";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const next = readSingle(params.next) ?? "/";

  if (await hasDashboardAccess()) {
    redirect(next);
  }

  const hasError = readSingle(params.error) === "1";

  return (
    <main className="login-shell">
      <form action={loginAction} className="login-box">
        <input type="hidden" name="next" value={next} />
        <div>
          <p className="eyebrow">Private dashboard</p>
          <h1>Job Tracker</h1>
          <p className="muted">Enter the passphrase to continue.</p>
        </div>
        <label className="field">
          <span>Passphrase</span>
          <input name="password" type="password" autoComplete="current-password" />
        </label>
        {hasError ? <p className="form-error">That passphrase did not work.</p> : null}
        <button className="primary-button" type="submit">
          Open dashboard
        </button>
      </form>
    </main>
  );
}

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
