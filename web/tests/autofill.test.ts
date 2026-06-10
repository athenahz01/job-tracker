import { readFileSync } from "fs";
import { Script, createContext } from "vm";
import { describe, expect, it, vi } from "vitest";

const autofillSource = readFileSync("../extension/autofill.js", "utf8");

describe("extension autofill helper", () => {
  it("fills first and last name precisely and never puts the name into address fields", () => {
    const firstName = fakeControl("input", { name: "first_name" }, "First Name");
    const lastName = fakeControl("input", { name: "last_name" }, "Last Name");
    const fullName = fakeControl("input", { name: "candidate_name" }, "Full Name");
    const city = fakeControl("input", { name: "city" }, "City");
    const state = fakeControl("input", { name: "state" }, "State");
    const country = fakeControl("input", { name: "country" }, "Country");
    const document = fakeDocument([firstName, lastName, fullName, city, state, country]);
    const autofill = loadAutofill(document);

    const result = autofill.applyAutofill({
      first_name: "Athena",
      last_name: "Huo",
      full_name: "Athena Huo",
      city: "New York",
      state: "NY",
      country: "United States"
    });

    expect(firstName.value).toBe("Athena");
    expect(lastName.value).toBe("Huo");
    expect(fullName.value).toBe("Athena Huo");
    expect(city.value).toBe("New York");
    expect(state.value).toBe("NY");
    expect(country.value).toBe("United States");
    expect([city.value, state.value, country.value]).not.toContain("Athena Huo");
    expect(result.fieldsFilled.map((item: { field: string }) => item.field)).toEqual([
      "first_name",
      "last_name",
      "full_name",
      "city",
      "state",
      "country"
    ]);
  });

  it("sets native gender and country selects only when an option matches", () => {
    const gender = fakeControl(
      "select",
      { name: "gender" },
      "Gender",
      "",
      [
        ["", "Select"],
        ["female", "Female"],
        ["male", "Male"]
      ]
    );
    const country = fakeControl(
      "select",
      { name: "country" },
      "Country",
      "",
      [
        ["", "Select"],
        ["US", "United States"],
        ["CA", "Canada"]
      ]
    );
    const unmatchedCountry = fakeControl(
      "select",
      { name: "country_of_residence" },
      "Country",
      "",
      [
        ["", "Select"],
        ["CA", "Canada"]
      ]
    );
    const document = fakeDocument([gender, country, unmatchedCountry]);
    const autofill = loadAutofill(document);

    autofill.applyAutofill({
      gender: "Female",
      country: "United States"
    });

    expect(gender.value).toBe("female");
    expect(country.value).toBe("US");
    expect(unmatchedCountry.value).toBe("");
  });

  it("fills education and work fields from the most recent structured entries", () => {
    const school = fakeControl("input", { name: "school_name" }, "School");
    const degree = fakeControl("input", { name: "degree" }, "Degree");
    const fieldOfStudy = fakeControl("input", { name: "field_of_study" }, "Field of Study");
    const company = fakeControl("input", { name: "company" }, "Company");
    const title = fakeControl("input", { name: "job_title" }, "Job Title");
    const description = fakeControl("textarea", { name: "work_description" }, "Work Description");
    const document = fakeDocument([school, degree, fieldOfStudy, company, title, description]);
    const autofill = loadAutofill(document);

    autofill.applyAutofill(
      {},
      [],
      [
        {
          school: "Recent University",
          degree: "MS",
          field_of_study: "Computer Science",
          sort_order: 0,
          updated_at: "2026-01-01T00:00:00.000Z"
        },
        {
          school: "Older College",
          degree: "BS",
          field_of_study: "Math",
          sort_order: 1,
          updated_at: "2024-01-01T00:00:00.000Z"
        }
      ],
      [
        {
          company: "Recent Co",
          title: "Product Engineer",
          description: "Built analytics tools.",
          sort_order: 0,
          updated_at: "2026-01-01T00:00:00.000Z"
        }
      ]
    );

    expect(school.value).toBe("Recent University");
    expect(degree.value).toBe("MS");
    expect(fieldOfStudy.value).toBe("Computer Science");
    expect(company.value).toBe("Recent Co");
    expect(title.value).toBe("Product Engineer");
    expect(description.value).toBe("Built analytics tools.");
  });

  it("skips file inputs, custom comboboxes, unmatched fields, and pre-filled values", () => {
    const resume = fakeControl("input", { type: "file", name: "resume" }, "Resume");
    const customCountry = fakeControl(
      "input",
      { role: "combobox", name: "country" },
      "Country"
    );
    const mystery = fakeControl("input", { name: "favorite_color" }, "Favorite color");
    const email = fakeControl(
      "input",
      { type: "email", name: "email" },
      "Email",
      "typed@example.com"
    );
    const document = fakeDocument([resume, customCountry, mystery, email]);
    const autofill = loadAutofill(document);

    autofill.applyAutofill({
      email: "profile@example.com",
      country: "United States"
    });

    expect(resume.value).toBe("");
    expect(customCountry.value).toBe("");
    expect(mystery.value).toBe("");
    expect(email.value).toBe("typed@example.com");
  });
});

function loadAutofill(document: ReturnType<typeof fakeDocument>) {
  const context = createContext({
    CSS: { escape: (value: string) => value },
    Event: class {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    },
    document,
    globalThis: null
  });
  context.globalThis = context;
  new Script(autofillSource).runInContext(context);
  return (context as unknown as { JobTrackerAutofill: { applyAutofill: Function } })
    .JobTrackerAutofill;
}

function fakeControl(
  tagName: "input" | "select" | "textarea",
  attributes: Record<string, string>,
  label: string,
  value = "",
  options: [string, string][] = []
) {
  const attrs = new Map(Object.entries(attributes));
  const element = {
    checked: false,
    disabled: false,
    dispatchEvent: vi.fn(),
    getAttribute: (name: string) => attrs.get(name) ?? null,
    labels: [{ innerText: label, textContent: label }],
    options: options.map(([optionValue, text]) => ({
      disabled: false,
      textContent: text,
      value: optionValue
    })),
    readOnly: false,
    setAttribute: (name: string, nextValue: string) => attrs.set(name, nextValue),
    tagName: tagName.toUpperCase(),
    value,
    closest: () => null
  };
  return element;
}

function fakeDocument(elements: ReturnType<typeof fakeControl>[]) {
  return {
    querySelector: () => null,
    querySelectorAll: (selector: string) => {
      if (selector === "input, select, textarea") {
        return elements;
      }
      if (selector === "textarea") {
        return elements.filter((element) => element.tagName === "TEXTAREA");
      }
      return [];
    }
  };
}
