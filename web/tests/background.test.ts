import { readFileSync } from "fs";
import { Script, createContext } from "vm";
import { describe, expect, it, vi } from "vitest";

const sharedSource = readFileSync("../extension/shared.js", "utf8");
const backgroundSource = readFileSync("../extension/background.js", "utf8");

describe("extension background", () => {
  it("posts cached postings through the background worker", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, ignored: false })
    });
    const listener = loadBackground(fetchMock, {
      apiBaseUrl: "http://localhost:3000",
      apiSecret: "test-secret"
    });

    const response = await sendBackgroundMessage(listener, {
      type: "CACHE_POSTING",
      posting: {
        url: "https://jobs.example.com/acme/backend-engineer?utm_source=x",
        company: "Acme",
        role: "Backend Engineer",
        location: "Remote US",
        tags: ["Remote"]
      }
    });

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/posting",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-extension-api-secret": "test-secret"
        },
        body: expect.any(String)
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        url: "https://jobs.example.com/acme/backend-engineer",
        company: "Acme",
        role: "Backend Engineer",
        location: "Remote US",
        tags: ["Remote"]
      })
    );
  });
});

function loadBackground(
  fetchMock: ReturnType<typeof vi.fn>,
  settings: { apiBaseUrl: string; apiSecret: string }
) {
  let listener:
    | ((message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean)
    | null = null;
  const context = createContext({
    chrome: {
      runtime: {
        onMessage: {
          addListener: (
            callback: (
              message: unknown,
              sender: unknown,
              sendResponse: (response: unknown) => void
            ) => boolean
          ) => {
            listener = callback;
          }
        }
      },
      storage: {
        local: {
          get: (_keys: unknown, callback: (value: unknown) => void) => {
            callback({ jobTrackerSettings: settings });
          },
          set: (_values: unknown, callback: () => void) => callback()
        }
      }
    },
    fetch: fetchMock,
    importScripts: (file: string) => {
      if (file !== "shared.js") {
        throw new Error(`Unexpected import ${file}`);
      }
      new Script(sharedSource).runInContext(context);
    },
    self: null,
    URL
  });
  context.self = context;

  new Script(backgroundSource).runInContext(context);
  if (!listener) {
    throw new Error("background listener was not registered");
  }
  return listener;
}

function sendBackgroundMessage(
  listener: (
    message: unknown,
    sender: unknown,
    sendResponse: (response: unknown) => void
  ) => boolean,
  message: unknown
) {
  return new Promise<Record<string, unknown>>((resolve) => {
    const keptOpen = listener(message, {}, (response) => {
      resolve(response as Record<string, unknown>);
    });
    expect(keptOpen).toBe(true);
  });
}
