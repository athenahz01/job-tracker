"use client";

import { useActionState, useState } from "react";

import {
  draftApplicationFollowUpAction,
  draftColdOutreachAction,
  draftContactOutreachAction,
  draftInterviewPracticeAnswerAction,
  draftNetworkingMessageAction,
  type DraftActionState
} from "../lib/ai-draft-actions";
import type { NetworkingDraftVariant } from "../lib/draft-prompts";

type DraftKind =
  | "follow-up"
  | "contact-outreach"
  | "cold-outreach"
  | "networking"
  | "interview-practice";

type DraftActionPanelProps = {
  kind: DraftKind;
  label: string;
  description?: string;
  applicationId?: string;
  contactId?: string;
  variant?: NetworkingDraftVariant;
  question?: string;
  compact?: boolean;
};

const initialState: DraftActionState = {
  ok: false,
  text: "",
  error: null
};

export default function DraftActionPanel({
  kind,
  label,
  description,
  applicationId,
  contactId,
  variant,
  question,
  compact = false
}: DraftActionPanelProps) {
  const [copied, setCopied] = useState(false);
  const [state, formAction, isPending] = useActionState(actionForKind(kind), initialState);

  async function copyDraft() {
    if (!state.text) {
      return;
    }
    await navigator.clipboard.writeText(state.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className={compact ? "draft-action compact-draft-action" : "draft-action"}>
      <form action={formAction} className="draft-action-form">
        {applicationId ? <input type="hidden" name="applicationId" value={applicationId} /> : null}
        {contactId ? <input type="hidden" name="contactId" value={contactId} /> : null}
        {variant ? <input type="hidden" name="variant" value={variant} /> : null}
        {question ? <input type="hidden" name="question" value={question} /> : null}
        {compact ? null : (
          <div>
            <strong>{label}</strong>
            {description ? <p className="muted">{description}</p> : null}
          </div>
        )}
        <button className="secondary-button" type="submit" disabled={isPending}>
          {isPending ? "Drafting..." : compact ? label : "Draft"}
        </button>
      </form>

      {state.error ? <p className="form-error">{state.error}</p> : null}

      {state.text ? (
        <div className="copy-panel">
          <textarea readOnly value={state.text} rows={compact ? 5 : 7} />
          <button className="secondary-button" type="button" onClick={copyDraft}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function actionForKind(kind: DraftKind) {
  if (kind === "follow-up") {
    return draftApplicationFollowUpAction;
  }
  if (kind === "contact-outreach") {
    return draftContactOutreachAction;
  }
  if (kind === "networking") {
    return draftNetworkingMessageAction;
  }
  if (kind === "interview-practice") {
    return draftInterviewPracticeAnswerAction;
  }
  return draftColdOutreachAction;
}
