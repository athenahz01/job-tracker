importScripts("shared.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "SAVE_APPLICATION") {
    return false;
  }

  saveApplication(message.capture, message.source, Boolean(message.auto), message.stage)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        message: error instanceof Error ? error.message : "Could not save this job."
      });
    });

  return true;
});

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
