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

    const capture = await global.JobTrackerScraper.scrapeCurrentPageWithRetry({
      timeoutMs: 3000,
      intervalMs: 250
    });
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
      await chrome.runtime.sendMessage({
        type: "CACHE_POSTING",
        posting: payload
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
        capture.location &&
        !isConfirmationText(capture.role) &&
        !isConfirmationText(capture.location)
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
