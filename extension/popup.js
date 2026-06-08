(function runPopup() {
  const shared = window.JobTrackerShared;
  const saveButton = document.getElementById("save-current");
  const optionsButton = document.getElementById("open-options");
  const settingsMessage = document.getElementById("settings-message");
  const status = document.getElementById("status");
  const manualForm = document.getElementById("manual-form");
  const companyInput = document.getElementById("company");
  const roleInput = document.getElementById("role");
  const locationInput = document.getElementById("location");
  const salaryInput = document.getElementById("salary");
  const tagsInput = document.getElementById("tags");
  const submitButton = document.getElementById("submit-capture");
  let pendingCapture = null;
  let pendingSource = "extension";
  let pendingStage = "Saved";

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
      pendingStage = capture.confirmation || capture.genericSubmitted ? "Applied" : "Saved";

      if (capture.genericSubmitted) {
        const confirmed = window.confirm("This looks like a submitted application. Mark it as applied?");
        if (!confirmed) {
          setStatus("Not logged.", "");
          return;
        }
      }

      populateForm(capture, pendingStage);
      manualForm.hidden = false;
      setStatus(
        capture.company ? "Review details, then save." : "Add the company name, then save.",
        ""
      );
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
      role: roleInput.value || pendingCapture.role,
      location: locationInput.value,
      salary: salaryInput.value,
      tags: shared.parseTags(tagsInput.value)
    };
    await postCapture(capture, pendingSource, pendingStage);
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

  async function postCapture(capture, source, stage) {
    setStatus(stage === "Applied" ? "Marking as applied..." : "Saving for later...", "");
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_APPLICATION",
      capture,
      source,
      stage,
      auto: false
    });

    if (!response || !response.ok) {
      setStatus(response && response.message ? response.message : "Could not save this job.", "error");
      return;
    }

    manualForm.hidden = true;
    if (stage === "Applied") {
      setStatus(response.deduped ? "Moved to Applied." : "Marked as applied.", "success");
      return;
    }
    setStatus(response.deduped ? "Already saved." : "Saved for later.", "success");
  }

  function populateForm(capture, stage) {
    companyInput.value = capture.company || "";
    roleInput.value = capture.role || "";
    locationInput.value = capture.location || "";
    salaryInput.value = capture.salary || "";
    tagsInput.value = shared.parseTags(capture.tags).join(", ");
    submitButton.textContent = stage === "Applied" ? "Mark as applied" : "Save for later";
  }

  function setStatus(message, className) {
    status.textContent = message;
    status.className = className ? `status ${className}` : "status";
  }

  function clearStatus() {
    setStatus("", "");
  }
})();
