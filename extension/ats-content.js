(function runAtsDetection() {
  let lastAttemptedUrl = "";
  let observerStarted = false;

  function attemptAutoSave() {
    if (!window.JobTrackerScraper) {
      return;
    }

    const capture = window.JobTrackerScraper.scrapeCurrentPage();
    if (!capture.ats || !capture.confirmation || !capture.company) {
      return;
    }

    if (capture.url === lastAttemptedUrl) {
      return;
    }
    lastAttemptedUrl = capture.url;

    chrome.runtime.sendMessage(
      {
        type: "SAVE_APPLICATION",
        capture,
        source: "extension",
        auto: true
      },
      () => {
        if (chrome.runtime.lastError) {
          return;
        }
      }
    );
  }

  function startObserver() {
    if (observerStarted || !document.body) {
      return;
    }
    observerStarted = true;

    const observer = new MutationObserver(debounce(attemptAutoSave, 800));
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 20000);
  }

  function debounce(fn, delay) {
    let timer = 0;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  setTimeout(attemptAutoSave, 1200);
  startObserver();
})();
