"use client";

import { FormEvent, useState, useTransition } from "react";

import { askPipelineAssistantAction } from "../lib/copilot-actions";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const examples = [
  "What should I follow up on this week?",
  "Summarize my pipeline.",
  "Which applications are going stale?",
  "Who in my network should I ping?"
];

export default function AssistantView() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPending, startTransition] = useTransition();

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isPending) {
      return;
    }

    const userMessage = message("user", trimmed);
    setMessages((current) => [...current.slice(-5), userMessage]);
    setQuestion("");

    startTransition(async () => {
      const result = await askPipelineAssistantAction(trimmed);
      const assistantText = result.ok
        ? result.answer
        : result.error || "The assistant could not answer right now.";
      setMessages((current) => [...current.slice(-5), message("assistant", assistantText)]);
    });
  }

  return (
    <section className="assistant-section" aria-labelledby="assistant-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Pipeline copilot</p>
          <h2 id="assistant-heading">Assistant</h2>
        </div>
        <span className="flow-count">Tracker context only</span>
      </div>

      <div className="assistant-layout">
        <div className="assistant-thread" aria-live="polite">
          {messages.length ? (
            messages.map((item) => (
              <article className={`assistant-message ${item.role}`} key={item.id}>
                <p>{item.role === "user" ? "You" : "Assistant"}</p>
                <div>{item.text}</div>
              </article>
            ))
          ) : (
            <div className="assistant-empty">
              <h3>Ask about your pipeline.</h3>
              <p>
                The assistant can reason over stages, follow-ups, stale applications, contacts,
                and fit scores already in the tracker.
              </p>
            </div>
          )}
        </div>

        <form className="assistant-form" onSubmit={submitQuestion}>
          <label className="field wide-field">
            <span>Question</span>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              placeholder="Ask what needs attention next..."
            />
          </label>
          <div className="assistant-examples" aria-label="Example questions">
            {examples.map((example) => (
              <button
                className="secondary-button"
                key={example}
                type="button"
                onClick={() => setQuestion(example)}
              >
                {example}
              </button>
            ))}
          </div>
          <button className="primary-button" type="submit" disabled={isPending}>
            {isPending ? "Thinking..." : "Ask assistant"}
          </button>
        </form>
      </div>
    </section>
  );
}

function message(role: Message["role"], text: string): Message {
  return {
    id: crypto.randomUUID(),
    role,
    text
  };
}
