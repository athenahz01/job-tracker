import { readFileSync } from "fs";
import { Script, createContext } from "vm";
import { describe, expect, it, vi } from "vitest";

const autofillSource = readFileSync("../extension/autofill.js", "utf8");

describe("extension autofill helper", () => {
  it("maps representative fields and does not overwrite pre-filled values", () => {
    const firstName = fakeControl("input", { name: "first_name" }, "First name");
    const lastName = fakeControl("input", { name: "last_name" }, "Last name");
    const email = fakeControl("input", { type: "email", name: "email" }, "Email address");
    const phone = fakeControl("input", { type: "tel", name: "phone" }, "Phone", "Already typed");
    const linkedin = fakeControl("input", { name: "linkedin_profile" }, "LinkedIn profile");
    const question = fakeControl("textarea", { id: "why-company" }, "Why this company?");
    const document = fakeDocument([firstName, lastName, email, phone, linkedin, question]);
    const autofill = loadAutofill(document);

    const result = autofill.applyAutofill(
      {
        full_name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "555-0100",
        linkedin_url: "https://linkedin.com/in/ada"
      },
      [
        {
          question: "Why this company?",
          answer: "I am interested because the product solves a real workflow problem.",
          tags: ["motivation"]
        }
      ]
    );

    expect(firstName.value).toBe("Ada");
    expect(lastName.value).toBe("Lovelace");
    expect(email.value).toBe("ada@example.com");
    expect(phone.value).toBe("Already typed");
    expect(linkedin.value).toBe("https://linkedin.com/in/ada");
    expect(question.value).toBe(
      "I am interested because the product solves a real workflow problem."
    );
    expect(result.fieldsFilled.map((item: { field: string }) => item.field)).toEqual([
      "first_name",
      "last_name",
      "email",
      "linkedin_url"
    ]);
    expect(result.answersFilled).toHaveLength(1);
    expect(result.openQuestions).toEqual([]);
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
  tagName: "input" | "textarea",
  attributes: Record<string, string>,
  label: string,
  value = ""
) {
  const attrs = new Map(Object.entries(attributes));
  const element = {
    checked: false,
    disabled: false,
    dispatchEvent: vi.fn(),
    getAttribute: (name: string) => attrs.get(name) ?? null,
    labels: [{ innerText: label, textContent: label }],
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
      if (selector === "input, select") {
        return elements.filter((element) => element.tagName === "INPUT");
      }
      if (selector === "textarea") {
        return elements.filter((element) => element.tagName === "TEXTAREA");
      }
      return [];
    }
  };
}
