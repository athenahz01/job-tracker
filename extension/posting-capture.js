(function runPostingCapture(global) {
  const shared = global.JobTrackerShared;
  let lastSentKey = "";
  let observerStarted = false;
  let timer = 0;

  function scheduleCapture() {
    if (typeof setTimeout !== "function") {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(attemptCapture, 900);
  }

  async function attemptCapture() {
    if (!shared || !global.JobTrackerScraper) {
      return;
    }

    const capture = global.JobTrackerScraper.scrapeCurrentPage();
    if (!isConfidentPosting(capture, document.body ? document.body.innerText : "")) {
      return;
    }

    const payload = buildPostingPayload(capture);
    const key = [
      payload.url,
      payload.company,
      payload.role,
      payload.salary,
      payload.location
    ].join("|");
    if (key === lastSentKey) {
      return;
    }
    lastSentKey = key;

    try {
      const settings = await shared.getSettings();
      if (!shared.settingsAreReady(settings)) {
        return;
      }

      await fetch(`${settings.apiBaseUrl}/api/posting`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-extension-api-secret": settings.apiSecret
        },
        body: JSON.stringify(payload)
      });
    } catch {
      // Posting enrichment is best effort and should never interrupt browsing.
    }
  }

  function startObserver() {
    if (
      observerStarted ||
      !document.body ||
      typeof MutationObserver === "undefined" ||
      typeof setTimeout !== "function"
    ) {
      return;
    }
    observerStarted = true;

    const observer = new MutationObserver(scheduleCapture);
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 20000);
  }

  function isConfidentPosting(capture, bodyText) {
    if (!capture || capture.confirmation || capture.genericSubmitted) {
      return false;
    }
    if (isConfirmationText(bodyText || "")) {
      return false;
    }
    return Boolean(
      capture.url &&
        capture.company &&
        capture.role &&
        !isConfirmationText(capture.role) &&
        (capture.salary || capture.location)
    );
  }

  function buildPostingPayload(capture) {
    return {
      url: capture.url,
      company: capture.company || null,
      role: capture.role || null,
      salary: capture.salary || null,
      location: capture.location || null,
      tags: shared.parseTags(capture.tags)
    };
  }

  function isConfirmationText(value) {
    const normalized = shared.trimText(value, 4000).toLowerCase();
    return [
      "thank you for applying",
      "thanks for applying",
      "application received",
      "application submitted",
      "application has been submitted",
      "your application was submitted",
      "your application has been submitted"
    ].some((phrase) => normalized.includes(phrase));
  }

  global.JobTrackerPostingCapture = {
    buildPostingPayload,
    isConfidentPosting
  };

  if (typeof setTimeout === "function") {
    setTimeout(attemptCapture, 1400);
    startObserver();
  }
})(globalThis);
