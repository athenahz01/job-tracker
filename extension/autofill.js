(function attachAutofill(global) {
  const answerThreshold = 0.68;

  const fieldDefinitions = [
    field("first_name", "First name", "profile.first_name", {
      autocomplete: ["given-name"],
      patterns: [/first name/, /given name/],
      exclude: [/last name/, /family name/, /surname/, /full name/]
    }),
    field("last_name", "Last name", "profile.last_name", {
      autocomplete: ["family-name"],
      patterns: [/last name/, /family name/, /surname/],
      exclude: [/first name/, /given name/, /full name/]
    }),
    field("full_name", "Full name", "profile.full_name", {
      autocomplete: ["name"],
      patterns: [/full name/, /legal name/, /preferred name/, /candidate name/, /^name$/],
      exclude: [/first name/, /last name/, /family name/, /company/, /school/]
    }),
    field("email", "Email", "profile.email", {
      autocomplete: ["email"],
      inputTypes: ["email"],
      patterns: [/email/, /e mail/]
    }),
    field("phone", "Phone", "profile.phone", {
      autocomplete: ["tel", "tel-national"],
      inputTypes: ["tel"],
      patterns: [/phone/, /mobile/, /telephone/]
    }),
    field("city", "City", "profile.city", {
      autocomplete: ["address-level2"],
      patterns: [/^city$/, /current city/, /city town/],
      exclude: [/company/, /school/]
    }),
    field("state", "State", "profile.state", {
      autocomplete: ["address-level1"],
      patterns: [/^state$/, /state province/, /province/, /region/],
      exclude: [/status/, /veteran/]
    }),
    field("country", "Country", "profile.country", {
      autocomplete: ["country", "country-name"],
      patterns: [/^country$/, /country region/, /country of residence/]
    }),
    field("postal_code", "Postal code", "profile.postal_code", {
      autocomplete: ["postal-code"],
      patterns: [/postal code/, /zip code/, /^zip$/]
    }),
    field("location", "Location", "profile.location", {
      patterns: [/^location$/, /current location/, /where are you located/],
      exclude: [/city/, /state/, /province/, /country/, /postal/, /zip/, /company/, /school/]
    }),
    field("linkedin_url", "LinkedIn", "profile.linkedin_url", {
      patterns: [/linkedin/, /linked in/]
    }),
    field("github_url", "GitHub", "profile.github_url", {
      patterns: [/github/, /git hub/]
    }),
    field("portfolio_url", "Portfolio", "profile.portfolio_url", {
      patterns: [/portfolio/, /work samples/]
    }),
    field("website_url", "Website", "profile.website_url", {
      patterns: [/personal website/, /^website$/, /^web site$/, /homepage/],
      exclude: [/linkedin/, /github/, /portfolio/]
    }),
    field("work_authorized", "Work authorized", "profile.work_authorized", {
      patterns: [/authorized to work/, /legally authorized/, /eligible to work/, /work authorization/]
    }),
    field("requires_sponsorship", "Sponsorship", "profile.requires_sponsorship", {
      patterns: [/sponsorship/, /visa sponsorship/, /require sponsor/, /need sponsor/]
    }),
    field("gender", "Gender", "profile.gender", {
      patterns: [/^gender$/, /gender identity/]
    }),
    field("race_ethnicity", "Race or ethnicity", "profile.race_ethnicity", {
      patterns: [/race/, /ethnicity/, /race ethnicity/]
    }),
    field("hispanic_latino", "Hispanic or Latino", "profile.hispanic_latino", {
      patterns: [/hispanic/, /latino/, /latina/, /latinx/]
    }),
    field("veteran_status", "Veteran status", "profile.veteran_status", {
      patterns: [/veteran/]
    }),
    field("disability_status", "Disability status", "profile.disability_status", {
      patterns: [/disability/, /disabled/]
    }),
    field("lgbtq_status", "LGBTQ status", "profile.lgbtq_status", {
      patterns: [/lgbtq/, /lgbt/, /sexual orientation/]
    }),
    field("skills", "Skills", "profile.skills", {
      patterns: [/^skills$/, /technical skills/, /technologies/, /tools/]
    }),
    field("years_experience", "Years of experience", "profile.years_experience", {
      patterns: [/years of experience/, /years experience/, /total experience/]
    }),
    field("current_title", "Current title", "profile.current_title", {
      patterns: [/current title/, /current role/, /current position/]
    }),
    field("education_school", "School", "education.school", {
      patterns: [/school/, /university/, /college/, /institution/],
      exclude: [/company/, /employer/]
    }),
    field("education_degree", "Degree", "education.degree", {
      patterns: [/degree/]
    }),
    field("education_field", "Field of study", "education.field_of_study", {
      patterns: [/field of study/, /major/, /area of study/]
    }),
    field("education_start_date", "Education start", "education.start_date", {
      patterns: [/education .*start/, /school .*start/, /start .*education/, /start .*school/]
    }),
    field("education_end_date", "Education end", "education.end_date", {
      patterns: [/education .*end/, /school .*end/, /graduation/, /end .*education/, /end .*school/]
    }),
    field("education_gpa", "GPA", "education.gpa", {
      patterns: [/^gpa$/, /grade point/]
    }),
    field("work_company", "Company", "work.company", {
      patterns: [/current employer/, /employer/, /^company$/, /company name/],
      exclude: [/school/, /university/, /college/]
    }),
    field("work_title", "Work title", "work.title", {
      patterns: [/job title/, /position title/, /role title/, /^title$/],
      exclude: [/current title/]
    }),
    field("work_location", "Work location", "work.location", {
      patterns: [/work location/, /employment location/, /company location/]
    }),
    field("work_start_date", "Work start", "work.start_date", {
      patterns: [/work .*start/, /employment .*start/, /company .*start/, /start .*work/]
    }),
    field("work_end_date", "Work end", "work.end_date", {
      patterns: [/work .*end/, /employment .*end/, /company .*end/, /end .*work/]
    }),
    field("work_description", "Work description", "work.description", {
      patterns: [/responsibilities/, /work description/, /job description/, /role description/]
    })
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

  function applyAutofill(profile, answers, education, workExperience) {
    const data = {
      profile: normalizeProfile(profile),
      education: normalizeEducation(education)[0] || {},
      work: normalizeWorkExperience(workExperience)[0] || {}
    };
    const normalizedAnswers = normalizeAnswers(answers);
    const fieldsFilled = [];
    const answersFilled = [];
    const openQuestions = [];
    const skipped = {
      prefilled: 0,
      noValue: 0,
      lowConfidence: 0
    };

    for (const element of formControls()) {
      if (hasExistingValue(element)) {
        skipped.prefilled += 1;
        continue;
      }

      const match = classifyControl(element);
      if (!match) {
        skipped.lowConfidence += 1;
        continue;
      }

      const value = valueForPath(match.definition.path, data);
      if (!hasFillValue(value)) {
        skipped.noValue += 1;
        continue;
      }

      if (fillControl(element, value, match.definition)) {
        fieldsFilled.push({
          field: match.definition.key,
          label: match.definition.label,
          target: elementLabel(element) || attributeText(element),
          value: displayValue(value)
        });
      }
    }

    const textareas = Array.from(document.querySelectorAll("textarea")).filter(isUsableElement);
    textareas.forEach((element, index) => {
      if (hasExistingValue(element) || element.getAttribute("data-job-tracker-filled")) {
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

  function formControls() {
    return Array.from(document.querySelectorAll("input, select, textarea")).filter((element) => {
      if (!isUsableElement(element)) {
        return false;
      }
      const tag = tagName(element);
      const type = inputType(element);
      if (["hidden", "file", "submit", "button", "reset", "password"].includes(type)) {
        return false;
      }
      if (tag !== "select" && normalizeText(element.getAttribute("role") || "") === "combobox") {
        return false;
      }
      return true;
    });
  }

  function classifyControl(element) {
    const sources = controlSources(element);
    const candidates = [];

    for (const definition of fieldDefinitions) {
      const score = matchDefinition(definition, sources, element);
      if (score >= 0.76) {
        candidates.push({ definition, score });
      }
    }

    candidates.sort((left, right) => right.score - left.score);
    if (!candidates.length) {
      return null;
    }
    if (
      candidates.length > 1 &&
      Math.abs(candidates[0].score - candidates[1].score) < 0.03 &&
      candidates[0].definition.key !== candidates[1].definition.key
    ) {
      return null;
    }
    return candidates[0];
  }

  function matchDefinition(definition, sources, element) {
    const allText = normalizeText(sources.map((source) => source.text).join(" "));
    if (definition.exclude.some((pattern) => pattern.test(allText))) {
      return 0;
    }

    const autocomplete = normalizeText(element.getAttribute("autocomplete") || "");
    if (definition.autocomplete.includes(autocomplete)) {
      return 1;
    }

    const type = inputType(element);
    if (definition.inputTypes.includes(type)) {
      return 0.98;
    }

    let best = 0;
    for (const source of sources) {
      if (!source.text) {
        continue;
      }
      if (definition.patterns.some((pattern) => pattern.test(source.text))) {
        best = Math.max(best, source.score);
      }
    }
    return best;
  }

  function fillControl(element, value, definition) {
    const tag = tagName(element);
    const type = inputType(element);

    if (tag === "select") {
      return fillSelect(element, value, definition);
    }
    if (type === "radio") {
      return fillRadio(element, value, definition);
    }
    if (type === "checkbox") {
      return fillCheckbox(element, value, definition);
    }

    element.value = displayValue(value);
    element.setAttribute("data-job-tracker-filled", definition.key || "answer");
    dispatchInput(element);
    dispatchChange(element);
    return true;
  }

  function fillSelect(element, value, definition) {
    const options = Array.from(element.options || []);
    const option = options.find((item) => optionMatches(item, value, definition));
    if (!option) {
      return false;
    }

    element.value = option.value;
    element.setAttribute("data-job-tracker-filled", definition.key || "select");
    dispatchInput(element);
    dispatchChange(element);
    return true;
  }

  function fillRadio(element, value, definition) {
    if (!optionTextMatches(controlOptionText(element), value, definition)) {
      return false;
    }
    element.checked = true;
    element.setAttribute("data-job-tracker-filled", definition.key || "radio");
    dispatchInput(element);
    dispatchChange(element);
    return true;
  }

  function fillCheckbox(element, value, definition) {
    const desired = normalizeText(displayValue(value));
    if (desired === "yes" || desired === "true") {
      element.checked = true;
      element.setAttribute("data-job-tracker-filled", definition.key || "checkbox");
      dispatchInput(element);
      dispatchChange(element);
      return true;
    }
    return false;
  }

  function optionMatches(option, value, definition) {
    if (!option || option.disabled) {
      return false;
    }
    return optionTextMatches(`${option.textContent || ""} ${option.value || ""}`, value, definition);
  }

  function optionTextMatches(optionText, value, definition) {
    const normalizedOption = normalizeText(optionText);
    const desired = normalizeText(displayValue(value));
    if (!normalizedOption || !desired) {
      return false;
    }

    const aliases = valueAliases(desired, definition.key);
    return aliases.some(
      (alias) =>
        normalizedOption === alias ||
        normalizedOption.includes(alias) ||
        alias.includes(normalizedOption)
    );
  }

  function valueAliases(value, key) {
    const aliases = new Set([value]);
    if (["yes", "true"].includes(value)) {
      aliases.add("yes");
      aliases.add("true");
    }
    if (["no", "false"].includes(value)) {
      aliases.add("no");
      aliases.add("false");
    }
    if (key === "country" && ["us", "usa", "u s", "united states"].includes(value)) {
      aliases.add("united states");
      aliases.add("united states of america");
      aliases.add("usa");
      aliases.add("u s a");
      aliases.add("us");
    }
    return Array.from(aliases);
  }

  function hasExistingValue(element) {
    const tag = tagName(element);
    const type = inputType(element);
    if (type === "checkbox" || type === "radio") {
      return Boolean(element.checked);
    }
    if (tag === "select") {
      const value = trimText(element.value, 500);
      return Boolean(value && !["select", "choose", "none", "null", "placeholder"].includes(normalizeText(value)));
    }
    return Boolean(trimText(element.value, 500));
  }

  function controlSources(element) {
    return [
      { name: "label", score: 0.96, text: normalizeText(elementLabel(element)) },
      { name: "aria", score: 0.93, text: normalizeText(element.getAttribute("aria-label") || "") },
      { name: "name", score: 0.9, text: normalizeText(element.getAttribute("name") || "") },
      { name: "id", score: 0.88, text: normalizeText(element.getAttribute("id") || "") },
      {
        name: "placeholder",
        score: 0.84,
        text: normalizeText(element.getAttribute("placeholder") || "")
      },
      {
        name: "autocomplete",
        score: 0.82,
        text: normalizeText(element.getAttribute("autocomplete") || "")
      },
      {
        name: "automation",
        score: 0.82,
        text: normalizeText(
          `${element.getAttribute("data-automation-id") || ""} ${
            element.getAttribute("data-testid") || ""
          }`
        )
      }
    ];
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

  function controlOptionText(element) {
    return trimText(
      [
        elementLabel(element),
        element.getAttribute("value"),
        element.getAttribute("aria-label"),
        element.getAttribute("name")
      ]
        .filter(Boolean)
        .join(" "),
      500
    );
  }

  function valueForPath(path, data) {
    const [group, key] = path.split(".");
    const source = data[group] || {};
    if (path === "profile.full_name") {
      return source.full_name || joinName(data.profile.first_name, data.profile.last_name);
    }
    if (path === "profile.skills") {
      return Array.isArray(source.skills) ? source.skills.join(", ") : "";
    }
    if (path === "profile.requires_sponsorship") {
      if (source.requires_sponsorship === true) {
        return "Yes";
      }
      if (source.requires_sponsorship === false) {
        return "No";
      }
      return "";
    }
    return source[key] || "";
  }

  function hasFillValue(value) {
    return typeof value === "boolean" || Boolean(displayValue(value));
  }

  function displayValue(value) {
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    return trimText(String(value || ""), 8000);
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
      first_name: trimText(value.first_name, 120),
      last_name: trimText(value.last_name, 120),
      full_name: trimText(value.full_name, 180),
      email: trimText(value.email, 240),
      phone: trimText(value.phone, 80),
      location: trimText(value.location, 180),
      city: trimText(value.city, 120),
      state: trimText(value.state, 120),
      country: trimText(value.country, 120),
      postal_code: trimText(value.postal_code, 40),
      linkedin_url: trimText(value.linkedin_url, 500),
      github_url: trimText(value.github_url, 500),
      portfolio_url: trimText(value.portfolio_url, 500),
      website_url: trimText(value.website_url, 500),
      work_authorization: trimText(value.work_authorization, 500),
      work_authorized: trimText(value.work_authorized, 120),
      requires_sponsorship:
        typeof value.requires_sponsorship === "boolean" ? value.requires_sponsorship : null,
      years_experience: trimText(value.years_experience, 80),
      current_title: trimText(value.current_title, 180),
      gender: trimText(value.gender, 180),
      race_ethnicity: trimText(value.race_ethnicity, 240),
      hispanic_latino: trimText(value.hispanic_latino, 180),
      veteran_status: trimText(value.veteran_status, 180),
      disability_status: trimText(value.disability_status, 180),
      lgbtq_status: trimText(value.lgbtq_status, 180),
      skills: Array.isArray(value.skills) ? value.skills.map((item) => trimText(item, 80)).filter(Boolean) : []
    };
  }

  function normalizeEducation(items) {
    return normalizeRows(items).map((item) => ({
      school: trimText(item.school, 240),
      degree: trimText(item.degree, 180),
      field_of_study: trimText(item.field_of_study, 180),
      start_date: trimText(item.start_date, 80),
      end_date: trimText(item.end_date, 80),
      gpa: trimText(item.gpa, 40),
      sort_order: Number(item.sort_order) || 0,
      updated_at: trimText(item.updated_at, 80)
    }));
  }

  function normalizeWorkExperience(items) {
    return normalizeRows(items).map((item) => ({
      company: trimText(item.company, 180),
      title: trimText(item.title, 180),
      location: trimText(item.location, 180),
      start_date: trimText(item.start_date, 80),
      end_date: trimText(item.is_current ? "Present" : item.end_date, 80),
      is_current: Boolean(item.is_current),
      description: trimText(item.description, 8000),
      sort_order: Number(item.sort_order) || 0,
      updated_at: trimText(item.updated_at, 80)
    }));
  }

  function normalizeRows(items) {
    if (!Array.isArray(items)) {
      return [];
    }
    return [...items].sort((left, right) => {
      const leftOrder = Number(left && left.sort_order) || 0;
      const rightOrder = Number(right && right.sort_order) || 0;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return trimText(right && right.updated_at, 80).localeCompare(
        trimText(left && left.updated_at, 80)
      );
    });
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

  function field(key, label, path, options) {
    return {
      key,
      label,
      path,
      autocomplete: options.autocomplete || [],
      inputTypes: options.inputTypes || [],
      patterns: options.patterns || [],
      exclude: options.exclude || []
    };
  }

  function joinName(first, last) {
    return [trimText(first, 120), trimText(last, 120)].filter(Boolean).join(" ");
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

  function tagName(element) {
    return element.tagName ? element.tagName.toLowerCase() : "";
  }

  function inputType(element) {
    return normalizeText(element.getAttribute("type") || "text");
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
    classifyControl,
    fillQuestionAnswer,
    questionTextForElement
  };
})(globalThis);
