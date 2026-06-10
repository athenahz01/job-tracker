(function attachAutofill(global) {
  const answerThreshold = 0.68;

  const fieldDefinitions = [
    {
      key: "full_name",
      label: "Full name",
      profileKey: "full_name",
      synonyms: ["full name", "legal name", "preferred name", "name"],
      autocomplete: ["name"],
      block: ["company", "employer", "school", "reference", "recruiter"]
    },
    {
      key: "first_name",
      label: "First name",
      profileKey: "full_name",
      transform: "first",
      synonyms: ["first name", "given name"],
      autocomplete: ["given-name"]
    },
    {
      key: "last_name",
      label: "Last name",
      profileKey: "full_name",
      transform: "last",
      synonyms: ["last name", "family name", "surname"],
      autocomplete: ["family-name"]
    },
    {
      key: "email",
      label: "Email",
      profileKey: "email",
      synonyms: ["email", "e-mail", "email address"],
      autocomplete: ["email"],
      types: ["email"]
    },
    {
      key: "phone",
      label: "Phone",
      profileKey: "phone",
      synonyms: ["phone", "phone number", "mobile", "telephone"],
      autocomplete: ["tel", "tel-national"],
      types: ["tel"]
    },
    {
      key: "location",
      label: "Location",
      profileKey: "location",
      synonyms: ["location", "city", "address", "current location", "where are you located"],
      autocomplete: ["address-level2", "street-address", "address-line1"]
    },
    {
      key: "linkedin_url",
      label: "LinkedIn",
      profileKey: "linkedin_url",
      synonyms: ["linkedin", "linked in", "linkedin profile", "linkedin url"]
    },
    {
      key: "github_url",
      label: "GitHub",
      profileKey: "github_url",
      synonyms: ["github", "git hub", "github profile", "github url"]
    },
    {
      key: "portfolio_url",
      label: "Portfolio",
      profileKey: "portfolio_url",
      synonyms: ["portfolio", "portfolio url", "work samples"]
    },
    {
      key: "website_url",
      label: "Website",
      profileKey: "website_url",
      synonyms: ["personal website", "website", "homepage", "web site"]
    },
    {
      key: "work_authorization",
      label: "Work authorization",
      profileKey: "work_authorization",
      synonyms: [
        "work authorization",
        "authorized to work",
        "legally authorized",
        "eligible to work",
        "work eligibility"
      ]
    },
    {
      key: "requires_sponsorship",
      label: "Sponsorship",
      profileKey: "requires_sponsorship",
      synonyms: ["sponsorship", "visa sponsorship", "require sponsorship", "requires sponsorship"]
    },
    {
      key: "years_experience",
      label: "Years of experience",
      profileKey: "years_experience",
      synonyms: ["years of experience", "years experience", "experience level", "total experience"]
    },
    {
      key: "current_title",
      label: "Current title",
      profileKey: "current_title",
      synonyms: ["current title", "current role", "job title", "current position"]
    }
  ];

  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "do",
    "for",
    "from",
    "have",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "our",
    "that",
    "the",
    "this",
    "to",
    "we",
    "what",
    "when",
    "where",
    "why",
    "will",
    "with",
    "you",
    "your"
  ]);

  function applyAutofill(profile, answers) {
    const normalizedProfile = normalizeProfile(profile);
    const normalizedAnswers = normalizeAnswers(answers);
    const fieldsFilled = [];
    const answersFilled = [];
    const openQuestions = [];
    const skipped = {
      prefilled: 0,
      noValue: 0,
      lowConfidence: 0
    };

    for (const element of profileControls()) {
      if (hasExistingValue(element)) {
        skipped.prefilled += 1;
        continue;
      }

      const match = matchProfileField(element);
      if (!match || match.score < 0.75) {
        skipped.lowConfidence += 1;
        continue;
      }

      const value = valueForDefinition(match.definition, normalizedProfile, element);
      if (value === "" || value === null || value === undefined || value === false) {
        skipped.noValue += 1;
        continue;
      }

      if (fillControl(element, value, match.definition)) {
        fieldsFilled.push({
          field: match.definition.key,
          label: match.definition.label,
          target: elementLabel(element) || attributeText(element)
        });
      }
    }

    const textareas = Array.from(document.querySelectorAll("textarea")).filter(isUsableElement);
    textareas.forEach((element, index) => {
      if (hasExistingValue(element)) {
        skipped.prefilled += 1;
        return;
      }

      const question = questionTextForElement(element);
      if (!question || !looksLikeScreenerQuestion(question)) {
        skipped.lowConfidence += 1;
        return;
      }

      const saved = bestAnswerMatch(question, normalizedAnswers);
      if (saved && saved.score >= answerThreshold) {
        if (fillControl(element, saved.answer, { key: "answer", label: "Answer" })) {
          answersFilled.push({
            question,
            matchedQuestion: saved.question,
            score: saved.score
          });
        }
        return;
      }

      const id = ensureQuestionId(element, index);
      openQuestions.push({ id, question });
    });

    return {
      ok: true,
      fieldsFilled,
      answersFilled,
      openQuestions,
      skipped,
      reviewReminder: "Review every filled field before submitting."
    };
  }

  function fillQuestionAnswer(questionIdOrText, answer) {
    const cleanAnswer = trimText(answer, 8000);
    if (!cleanAnswer) {
      return { ok: false, reason: "empty_answer" };
    }

    const textareas = Array.from(document.querySelectorAll("textarea")).filter(isUsableElement);
    const direct = textareas.find(
      (element) => element.getAttribute("data-job-tracker-question-id") === questionIdOrText
    );
    const target =
      direct ||
      textareas.find(
        (element) => similarity(questionTextForElement(element), questionIdOrText) >= 0.82
      );

    if (!target) {
      return { ok: false, reason: "question_not_found" };
    }

    if (hasExistingValue(target)) {
      return { ok: false, reason: "prefilled" };
    }

    fillControl(target, cleanAnswer, { key: "answer", label: "Answer" });
    return { ok: true };
  }

  function profileControls() {
    return Array.from(document.querySelectorAll("input, select")).filter((element) => {
      if (!isUsableElement(element)) {
        return false;
      }
      if (element.tagName && element.tagName.toLowerCase() === "select") {
        return true;
      }

      const type = (element.getAttribute("type") || "text").toLowerCase();
      return !["hidden", "file", "submit", "button", "reset", "radio", "password"].includes(type);
    });
  }

  function matchProfileField(element) {
    const label = normalizeText(elementLabel(element));
    const attrs = normalizeText(attributeText(element));
    const autocomplete = normalizeText(element.getAttribute("autocomplete") || "");
    const inputType = normalizeText(element.getAttribute("type") || "");
    const combined = normalizeText(`${label} ${attrs}`);

    let best = null;
    for (const definition of fieldDefinitions) {
      if (definition.block && definition.block.some((term) => combined.includes(term))) {
        continue;
      }

      let score = 0;
      if (definition.autocomplete && definition.autocomplete.includes(autocomplete)) {
        score = Math.max(score, 0.98);
      }
      if (definition.types && definition.types.includes(inputType)) {
        score = Math.max(score, 0.88);
      }

      for (const synonym of definition.synonyms) {
        const normalized = normalizeText(synonym);
        if (!normalized) {
          continue;
        }
        if (label === normalized) {
          score = Math.max(score, 0.98);
        } else if (label.includes(normalized)) {
          score = Math.max(score, 0.92);
        } else if (attrs.includes(normalized)) {
          score = Math.max(score, 0.84);
        } else {
          const tokenScore = tokenSimilarity(combined, normalized);
          if (tokenScore >= 0.8) {
            score = Math.max(score, 0.78);
          }
        }
      }

      if (!best || score > best.score) {
        best = { definition, score };
      }
    }

    return best && best.score > 0 ? best : null;
  }

  function bestAnswerMatch(question, answers) {
    let best = null;
    for (const answer of answers) {
      const score = similarity(question, answer.question);
      if (!best || score > best.score) {
        best = { ...answer, score };
      }
    }
    return best;
  }

  function valueForDefinition(definition, profile, element) {
    if (definition.key === "requires_sponsorship") {
      if (profile.requires_sponsorship === null || profile.requires_sponsorship === undefined) {
        return null;
      }
      if (element.tagName && element.tagName.toLowerCase() === "select") {
        return profile.requires_sponsorship ? "yes" : "no";
      }
      return Boolean(profile.requires_sponsorship);
    }

    const raw = trimText(profile[definition.profileKey], 1000);
    if (!raw) {
      return "";
    }
    if (definition.transform === "first") {
      return firstName(raw);
    }
    if (definition.transform === "last") {
      return lastName(raw);
    }
    return raw;
  }

  function fillControl(element, value, definition) {
    const tag = element.tagName ? element.tagName.toLowerCase() : "";
    const type = (element.getAttribute("type") || "").toLowerCase();

    if (type === "checkbox") {
      if (!value) {
        return false;
      }
      element.checked = true;
      dispatchChange(element);
      return true;
    }

    if (tag === "select") {
      return fillSelect(element, value);
    }

    element.value = String(value);
    element.setAttribute("data-job-tracker-filled", definition.key || "answer");
    dispatchInput(element);
    dispatchChange(element);
    return true;
  }

  function fillSelect(element, value) {
    const normalizedValue = normalizeText(String(value));
    const options = Array.from(element.options || []);
    const option = options.find((item) => {
      const optionText = normalizeText(`${item.textContent || ""} ${item.value || ""}`);
      if (!optionText || option.disabled) {
        return false;
      }
      if (normalizedValue === "yes") {
        return /\b(yes|true|require|need)\b/.test(optionText);
      }
      if (normalizedValue === "no") {
        return /\b(no|false|not|do not|dont|don't)\b/.test(optionText);
      }
      return optionText.includes(normalizedValue) || normalizedValue.includes(optionText);
    });

    if (!option) {
      return false;
    }

    element.value = option.value;
    element.setAttribute("data-job-tracker-filled", "select");
    dispatchInput(element);
    dispatchChange(element);
    return true;
  }

  function hasExistingValue(element) {
    const tag = element.tagName ? element.tagName.toLowerCase() : "";
    const type = (element.getAttribute("type") || "").toLowerCase();
    if (type === "checkbox") {
      return Boolean(element.checked);
    }
    if (tag === "select") {
      const value = trimText(element.value, 500);
      return Boolean(value && !["select", "choose", "none", "null"].includes(normalizeText(value)));
    }
    return Boolean(trimText(element.value, 500));
  }

  function elementLabel(element) {
    const parts = [];
    if (element.labels && element.labels.length) {
      for (const label of Array.from(element.labels)) {
        parts.push(textFromNode(label, 500));
      }
    }

    const id = element.getAttribute("id");
    if (id && document.querySelector) {
      const label = document.querySelector(`label[for="${cssEscape(id)}"]`);
      parts.push(textFromNode(label, 500));
    }

    if (element.closest) {
      parts.push(textFromNode(element.closest("label"), 500));
      parts.push(textFromNode(element.closest("[data-automation-id*='question']"), 500));
      parts.push(textFromNode(element.closest("[data-testid*='question']"), 500));
      parts.push(textFromNode(element.closest("[class*='question' i]"), 500));
      parts.push(textFromNode(element.closest("[class*='field' i]"), 350));
    }

    return trimText(parts.filter(Boolean).join(" "), 900);
  }

  function attributeText(element) {
    return trimText(
      [
        element.getAttribute("aria-label"),
        element.getAttribute("placeholder"),
        element.getAttribute("name"),
        element.getAttribute("id"),
        element.getAttribute("data-automation-id"),
        element.getAttribute("data-testid"),
        element.getAttribute("autocomplete")
      ]
        .filter(Boolean)
        .join(" "),
      900
    );
  }

  function questionTextForElement(element) {
    return trimText(
      [
        elementLabel(element),
        element.getAttribute("aria-label"),
        element.getAttribute("placeholder"),
        element.getAttribute("name"),
        element.getAttribute("id")
      ]
        .filter(Boolean)
        .join(" "),
      1000
    );
  }

  function looksLikeScreenerQuestion(text) {
    const normalized = normalizeText(text);
    if (!normalized || normalized.length < 8) {
      return false;
    }
    if (normalized.includes("cover letter") || normalized.includes("additional information")) {
      return true;
    }
    return /^(why|what|how|when|where|tell|describe|explain|please|are|do|will|can)\b/.test(
      normalized
    );
  }

  function ensureQuestionId(element, index) {
    const existing = element.getAttribute("data-job-tracker-question-id");
    if (existing) {
      return existing;
    }
    const id = `question-${Date.now()}-${index}`;
    element.setAttribute("data-job-tracker-question-id", id);
    return id;
  }

  function normalizeProfile(profile) {
    const value = profile && typeof profile === "object" ? profile : {};
    return {
      full_name: trimText(value.full_name, 180),
      email: trimText(value.email, 240),
      phone: trimText(value.phone, 80),
      location: trimText(value.location, 180),
      linkedin_url: trimText(value.linkedin_url, 500),
      github_url: trimText(value.github_url, 500),
      portfolio_url: trimText(value.portfolio_url, 500),
      website_url: trimText(value.website_url, 500),
      work_authorization: trimText(value.work_authorization, 500),
      requires_sponsorship:
        typeof value.requires_sponsorship === "boolean" ? value.requires_sponsorship : null,
      years_experience: trimText(value.years_experience, 80),
      current_title: trimText(value.current_title, 180)
    };
  }

  function normalizeAnswers(answers) {
    if (!Array.isArray(answers)) {
      return [];
    }
    return answers
      .map((item) => ({
        id: trimText(item && item.id, 80),
        question: trimText(item && item.question, 1000),
        answer: trimText(item && item.answer, 8000),
        tags: Array.isArray(item && item.tags) ? item.tags : []
      }))
      .filter((item) => item.question && item.answer);
  }

  function similarity(left, right) {
    const normalizedLeft = normalizeText(left);
    const normalizedRight = normalizeText(right);
    if (!normalizedLeft || !normalizedRight) {
      return 0;
    }
    if (normalizedLeft === normalizedRight) {
      return 1;
    }
    if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
      return 0.88;
    }
    return tokenSimilarity(normalizedLeft, normalizedRight);
  }

  function tokenSimilarity(left, right) {
    const leftTokens = uniqueTokens(left);
    const rightTokens = uniqueTokens(right);
    if (!leftTokens.length || !rightTokens.length) {
      return 0;
    }

    const rightSet = new Set(rightTokens);
    const overlap = leftTokens.filter((token) => rightSet.has(token)).length;
    return (2 * overlap) / (leftTokens.length + rightTokens.length);
  }

  function uniqueTokens(value) {
    return Array.from(
      new Set(
        normalizeText(value)
          .split(/\s+/)
          .filter((token) => token.length > 1 && !stopWords.has(token))
      )
    );
  }

  function firstName(fullName) {
    return trimText(fullName).split(/\s+/)[0] || fullName;
  }

  function lastName(fullName) {
    const parts = trimText(fullName).split(/\s+/).filter(Boolean);
    return parts.length > 1 ? parts.slice(1).join(" ") : "";
  }

  function textFromNode(node, maxLength) {
    if (!node) {
      return "";
    }
    return trimText(node.innerText || node.textContent || "", maxLength);
  }

  function isUsableElement(element) {
    if (!element || element.disabled || element.readOnly) {
      return false;
    }
    const type = (element.getAttribute("type") || "").toLowerCase();
    if (type === "hidden") {
      return false;
    }
    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    return true;
  }

  function dispatchInput(element) {
    dispatchEvent(element, "input");
  }

  function dispatchChange(element) {
    dispatchEvent(element, "change");
  }

  function dispatchEvent(element, name) {
    if (typeof Event !== "function" || !element.dispatchEvent) {
      return;
    }
    element.dispatchEvent(new Event(name, { bubbles: true }));
  }

  function normalizeText(value) {
    return trimText(value, 2000)
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/[^a-z0-9\s']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function trimText(value, maxLength) {
    if (typeof value !== "string") {
      return "";
    }
    const text = value.replace(/\s+/g, " ").trim();
    return maxLength ? text.slice(0, maxLength) : text;
  }

  function cssEscape(value) {
    if (global.CSS && typeof global.CSS.escape === "function") {
      return global.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, "\\$&");
  }

  global.JobTrackerAutofill = {
    applyAutofill,
    bestAnswerMatch,
    fillQuestionAnswer,
    matchProfileField,
    questionTextForElement
  };
})(globalThis);
