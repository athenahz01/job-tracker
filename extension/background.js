importScripts("shared.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !["SAVE_APPLICATION", "CHECK_FIT"].includes(message.type)) {
    return false;
  }

  const action =
    message.type === "CHECK_FIT"
      ? checkFit(message.capture)
      : saveApplication(message.capture, message.source, Boolean(message.auto), message.stage);

  action
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        message:
          error instanceof Error && error.message
            ? error.message
            : "The request could not be completed."
      });
    });

  return true;
});

async function checkFit(capture) {
  const shared = self.JobTrackerShared;
  const settings = await shared.getSettings();
  if (!shared.settingsAreReady(settings)) {
    return {
      ok: false,
      reason: "settings",
      message: "Open options and add the API URL and shared secret."
    };
  }

  const company = shared.trimText(capture && capture.company, 180);
  if (!company) {
    return {
      ok: false,
      reason: "company_required",
      message: "Company is required before checking fit."
    };
  }

  const body = {
    company,
    role: shared.trimText(capture && capture.role, 220) || null,
    jobDescription: shared.trimText(capture && capture.notes, 12000) || null
  };

  let response;
  try {
    response = await fetch(`${settings.apiBaseUrl}/api/score`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-extension-api-secret": settings.apiSecret
      },
      body: JSON.stringify(body)
    });
  } catch {
    return {
      ok: false,
      reason: "network",
      message: "Could not reach the API. Check the URL and extension permissions."
    };
  }

  const data = await safeJson(response);
  if (!response.ok || !data) {
    return {
      ok: false,
      reason: data && data.reason ? data.reason : "score_error",
      message: readableScoreError(response.status, data)
    };
  }

  if (data.ok === false) {
    return {
      ok: false,
      reason: data.reason || "score_error",
      message: readableScoreError(response.status, data)
    };
  }

  return {
    ok: true,
    fit_score: Number(data.fit_score),
    fit_summary: typeof data.fit_summary === "string" ? data.fit_summary : "",
    missing_keywords: Array.isArray(data.missing_keywords)
      ? data.missing_keywords.filter((item) => typeof item === "string").slice(0, 8)
      : []
  };
}

async function saveApplication(capture, source, auto, requestedStage) {
  const shared = self.JobTrackerShared;
  const stage =
    requestedStage === "Applied" || requestedStage === "Saved"
      ? requestedStage
      : auto
        ? "Applied"
        : "Saved";
  const settings = await shared.getSettings();
  if (!shared.settingsAreReady(settings)) {
    return {
      ok: false,
      message: "Open options and add the API URL and shared secret."
    };
  }

  const url = shared.cleanJobUrl(capture && capture.url);
  if (url) {
    const recent = await shared.getRecentPosts();
    if (shared.recentPostCoversStage(recent[url], stage)) {
      return {
        ok: true,
        deduped: true,
        skipped: true,
        message: "Already logged recently."
      };
    }
  }

  const company = shared.trimText(capture && capture.company, 180);
  if (!company) {
    return { ok: false, message: "Company is required before saving." };
  }

  const body = {
    company,
    role: shared.trimText(capture && capture.role, 220) || null,
    url: url || null,
    notes: shared.trimText(capture && capture.notes, 9000) || null,
    salary: shared.trimText(capture && capture.salary, 160) || null,
    location: shared.trimText(capture && capture.location, 180) || null,
    tags: shared.parseTags(capture && capture.tags),
    source: source || "extension",
    stage
  };

  let response;
  try {
    response = await fetch(`${settings.apiBaseUrl}/api/applications`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-extension-api-secret": settings.apiSecret
      },
      body: JSON.stringify(body)
    });
  } catch {
    return {
      ok: false,
      message: "Could not reach the API. Check the URL and extension permissions."
    };
  }

  const data = await safeJson(response);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: readableError(response.status, data)
    };
  }

  if (url) {
    await shared.rememberPost(url, stage);
  }

  return {
    ok: true,
    deduped: Boolean(data && data.deduped),
    data,
    message: data && data.deduped ? "Already logged." : "Logged."
  };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readableError(status, data) {
  if (status === 401) {
    return "The shared secret did not match.";
  }
  if (data && typeof data.message === "string") {
    return data.message;
  }
  return "The job could not be saved.";
}

function readableScoreError(status, data) {
  if (status === 401) {
    return "The shared secret did not match.";
  }
  if (data && data.reason === "no_resume") {
    return "Paste your master resume in the dashboard Profile tab first.";
  }
  if (data && data.reason === "company_required") {
    return "Company is required before checking fit.";
  }
  return "Could not check fit for this job.";
}
