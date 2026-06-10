(function runPopup() {
  const shared = window.JobTrackerShared;
  const saveButton = document.getElementById("save-current");
  const checkFitButton = document.getElementById("check-fit");
  const autofillButton = document.getElementById("autofill-application");
  const optionsButton = document.getElementById("open-options");
  const settingsMessage = document.getElementById("settings-message");
  const status = document.getElementById("status");
  const fitResult = document.getElementById("fit-result");
  const autofillResult = document.getElementById("autofill-result");
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
    checkFitButton.disabled = !ready;
    autofillButton.disabled = !ready;

    saveButton.addEventListener("click", handleSaveClick);
    checkFitButton.addEventListener("click", handleCheckFitClick);
    autofillButton.addEventListener("click", handleAutofillClick);
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

  async function handleCheckFitClick() {
    clearStatus();
    clearFitResult();
    checkFitButton.disabled = true;

    try {
      const capture = await scrapeActiveTab();
      if (capture.company || capture.role || capture.location || capture.salary || capture.tags) {
        pendingCapture = capture;
        populateForm(capture, pendingStage);
      }

      setStatus("Checking fit...", "");
      const response = await chrome.runtime.sendMessage({
        type: "CHECK_FIT",
        capture
      });

      if (!response || !response.ok) {
        setStatus(
          response && response.message ? response.message : "Could not check fit for this job.",
          "error"
        );
        return;
      }

      renderFitResult(response);
      setStatus("Fit checked.", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not check fit.", "error");
    } finally {
      checkFitButton.disabled = false;
    }
  }

  async function handleAutofillClick() {
    clearStatus();
    clearAutofillResult();
    autofillButton.disabled = true;

    try {
      setStatus("Loading autofill profile...", "");
      const profileResponse = await chrome.runtime.sendMessage({ type: "GET_PROFILE" });
      if (!profileResponse || !profileResponse.ok) {
        setStatus(
          profileResponse && profileResponse.message
            ? profileResponse.message
            : "Could not load your autofill profile.",
          "error"
        );
        return;
      }

      let capture = {};
      try {
        capture = await scrapeActiveTab();
      } catch {
        capture = {};
      }
      setStatus("Filling confident matches...", "");
      const result = await applyAutofillToActiveTab({
        profile: profileResponse.profile,
        education: profileResponse.education,
        workExperience: profileResponse.workExperience,
        answers: profileResponse.answers
      });

      renderAutofillResult(result, capture);
      setStatus("Autofill complete. Review before submitting.", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not autofill this page.", "error");
    } finally {
      autofillButton.disabled = false;
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
    const tab = await getActiveTab();
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["shared.js", "scraper.js"]
    });

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.JobTrackerScraper.scrapeCurrentPageWithRetry()
    });

    if (!result || !result.result) {
      throw new Error("Could not scrape this page.");
    }

    return result.result;
  }

  async function applyAutofillToActiveTab(payload) {
    const tab = await getActiveTab();

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["autofill.js"]
    });

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (autofillPayload) =>
        window.JobTrackerAutofill.applyAutofill(
          autofillPayload.profile,
          autofillPayload.answers,
          autofillPayload.education,
          autofillPayload.workExperience
        ),
      args: [payload]
    });

    if (!result || !result.result) {
      throw new Error("Could not autofill this page.");
    }

    return result.result;
  }

  async function fillAnswerInActiveTab(questionId, answer) {
    const tab = await getActiveTab();

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["autofill.js"]
    });

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (id, value) => window.JobTrackerAutofill.fillQuestionAnswer(id, value),
      args: [questionId, answer]
    });

    return result && result.result;
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error("No active tab found.");
    }
    return tab;
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

  function renderFitResult(result) {
    const score = Number.isFinite(result.fit_score) ? Math.round(result.fit_score) : null;
    const keywords = Array.isArray(result.missing_keywords)
      ? result.missing_keywords.slice(0, 5)
      : [];

    fitResult.hidden = false;
    fitResult.innerHTML = "";

    const header = document.createElement("div");
    header.className = "fit-result-header";

    const title = document.createElement("strong");
    title.textContent = "Fit";
    header.append(title);

    const badge = document.createElement("span");
    badge.className = `fit-badge ${fitClass(score)}`;
    badge.textContent = score === null ? "Not scored" : String(score);
    header.append(badge);
    fitResult.append(header);

    const summary = document.createElement("p");
    summary.textContent = result.fit_summary || "No verdict returned.";
    fitResult.append(summary);

    const gaps = document.createElement("div");
    gaps.className = "fit-gaps";
    if (keywords.length) {
      for (const keyword of keywords) {
        const chip = document.createElement("span");
        chip.textContent = keyword;
        gaps.append(chip);
      }
    } else {
      const empty = document.createElement("span");
      empty.textContent = "No top gaps returned";
      gaps.append(empty);
    }
    fitResult.append(gaps);
  }

  function clearFitResult() {
    fitResult.hidden = true;
    fitResult.innerHTML = "";
  }

  function renderAutofillResult(result, capture) {
    autofillResult.hidden = false;
    autofillResult.innerHTML = "";

    const header = document.createElement("div");
    header.className = "autofill-header";
    const title = document.createElement("strong");
    title.textContent = "Autofill";
    header.append(title);
    const count = document.createElement("span");
    const totalFilled =
      safeLength(result && result.fieldsFilled) + safeLength(result && result.answersFilled);
    count.textContent = `${totalFilled} filled`;
    header.append(count);
    autofillResult.append(header);

    if (safeLength(result && result.fieldsFilled)) {
      autofillResult.append(
        resultSection(
          "Profile fields",
          result.fieldsFilled.map((item) =>
            `${item.label}${item.value ? `: ${item.value}` : ""}${
              item.target ? ` (${item.target})` : ""
            }`
          )
        )
      );
    }

    if (safeLength(result && result.answersFilled)) {
      autofillResult.append(
        resultSection(
          "Saved answers",
          result.answersFilled.map((item) => item.matchedQuestion || item.question)
        )
      );
    }

    if (safeLength(result && result.openQuestions)) {
      const section = document.createElement("div");
      section.className = "autofill-section";
      const heading = document.createElement("strong");
      heading.textContent = "Open questions";
      section.append(heading);

      for (const question of result.openQuestions.slice(0, 5)) {
        section.append(renderOpenQuestion(question, capture));
      }
      autofillResult.append(section);
    }

    const reminder = document.createElement("p");
    reminder.textContent = "Review every field before submitting. Nothing was submitted.";
    autofillResult.append(reminder);
  }

  function renderOpenQuestion(question, capture) {
    const wrap = document.createElement("div");
    wrap.className = "autofill-question";

    const text = document.createElement("p");
    text.textContent = question.question;
    wrap.append(text);

    const button = document.createElement("button");
    button.className = "secondary";
    button.type = "button";
    button.textContent = "AI answer";
    button.addEventListener("click", () => handleDraftAnswer(question, capture, wrap, button));
    wrap.append(button);

    return wrap;
  }

  async function handleDraftAnswer(question, capture, wrap, button) {
    button.disabled = true;
    setStatus("Drafting answer...", "");

    try {
      const response = await chrome.runtime.sendMessage({
        type: "DRAFT_ANSWER",
        payload: {
          question: question.question,
          company: capture && capture.company,
          role: capture && capture.role,
          jobDescription: capture && capture.notes
        }
      });

      if (!response || !response.ok || !response.answer) {
        setStatus(
          response && response.message ? response.message : "Could not draft an answer.",
          "error"
        );
        return;
      }

      const fillResult = await fillAnswerInActiveTab(question.id, response.answer);
      if (!fillResult || !fillResult.ok) {
        setStatus("Answer drafted, but the field was already changed.", "error");
        return;
      }

      renderDraftPreview(wrap, question.question, response.answer);
      setStatus("Draft filled. Review before submitting.", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not draft an answer.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function renderDraftPreview(wrap, question, answer) {
    const existing = wrap.querySelector(".draft-preview");
    if (existing) {
      existing.remove();
    }

    const preview = document.createElement("div");
    preview.className = "draft-preview";

    const text = document.createElement("p");
    text.textContent = answer;
    preview.append(text);

    const saveButton = document.createElement("button");
    saveButton.className = "secondary";
    saveButton.type = "button";
    saveButton.textContent = "Save to answer bank";
    saveButton.addEventListener("click", async () => {
      saveButton.disabled = true;
      const response = await chrome.runtime.sendMessage({
        type: "SAVE_ANSWER",
        payload: {
          question,
          answer,
          tags: ["AI draft"]
        }
      });
      setStatus(
        response && response.ok ? "Answer saved." : response && response.message ? response.message : "Could not save answer.",
        response && response.ok ? "success" : "error"
      );
      saveButton.disabled = false;
    });
    preview.append(saveButton);

    wrap.append(preview);
  }

  function resultSection(title, items) {
    const section = document.createElement("div");
    section.className = "autofill-section";
    const heading = document.createElement("strong");
    heading.textContent = title;
    section.append(heading);

    const list = document.createElement("ul");
    for (const item of items) {
      const li = document.createElement("li");
      li.textContent = item;
      list.append(li);
    }
    section.append(list);
    return section;
  }

  function clearAutofillResult() {
    autofillResult.hidden = true;
    autofillResult.innerHTML = "";
  }

  function safeLength(value) {
    return Array.isArray(value) ? value.length : 0;
  }

  function fitClass(score) {
    if (score === null) {
      return "fit-empty";
    }
    if (score >= 70) {
      return "fit-high";
    }
    if (score >= 40) {
      return "fit-medium";
    }
    return "fit-low";
  }
})();
