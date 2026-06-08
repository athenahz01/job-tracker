(function runPopup() {
  const shared = window.JobTrackerShared;
  const saveButton = document.getElementById("save-current");
  const optionsButton = document.getElementById("open-options");
  const settingsMessage = document.getElementById("settings-message");
  const status = document.getElementById("status");
  const manualForm = document.getElementById("manual-form");
  const companyInput = document.getElementById("company");
  const roleInput = document.getElementById("role");
  let pendingCapture = null;
  let pendingSource = "extension";

  init();

  async function init() {
    const settings = await shared.getSettings();
    const ready = shared.settingsAreReady(settings);
    settingsMessage.hidden = ready;
    saveButton.disabled = !ready;

    saveButton.addEventListener("click", handleSaveClick);
    optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
    manualForm.addEventListener("submit", handleManualSubmit);
  }

  async function handleSaveClick() {
    clearStatus();
    saveButton.disabled = true;

    try {
      const capture = await scrapeActiveTab();
      pendingCapture = capture;
      pendingSource = capture.genericSubmitted ? "extension_heuristic" : "extension";

      if (capture.genericSubmitted) {
        const confirmed = window.confirm("This looks like a submitted application. Log it?");
        if (!confirmed) {
          setStatus("Not logged.", "");
          return;
        }
      }

      if (!capture.company) {
        companyInput.value = "";
        roleInput.value = capture.role || "";
        manualForm.hidden = false;
        setStatus("Add the company name, then save.", "");
        return;
      }

      await postCapture(capture, pendingSource);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not read this page.", "error");
    } finally {
      saveButton.disabled = false;
    }
  }

  async function handleManualSubmit(event) {
    event.preventDefault();
    if (!pendingCapture) {
      return;
    }

    const capture = {
      ...pendingCapture,
      company: companyInput.value,
      role: roleInput.value || pendingCapture.role
    };
    await postCapture(capture, pendingSource);
  }

  async function scrapeActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error("No active tab found.");
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["shared.js", "scraper.js"]
    });

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.JobTrackerScraper.scrapeCurrentPage()
    });

    if (!result || !result.result) {
      throw new Error("Could not scrape this page.");
    }

    return result.result;
  }

  async function postCapture(capture, source) {
    setStatus("Saving...", "");
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_APPLICATION",
      capture,
      source,
      auto: false
    });

    if (!response || !response.ok) {
      setStatus(response && response.message ? response.message : "Could not save this job.", "error");
      return;
    }

    manualForm.hidden = true;
    setStatus(response.deduped ? "Already logged." : "Logged.", "success");
  }

  function setStatus(message, className) {
    status.textContent = message;
    status.className = className ? `status ${className}` : "status";
  }

  function clearStatus() {
    setStatus("", "");
  }
})();
