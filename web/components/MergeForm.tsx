"use client";

import { mergeOrphanAction } from "../lib/dashboard-actions";
import { ApplicationRow } from "../lib/dashboard-data";

type MergeFormProps = {
  orphan: ApplicationRow;
  targets: ApplicationRow[];
};

export default function MergeForm({ orphan, targets }: MergeFormProps) {
  if (!targets.length) {
    return <p className="muted">No merge targets are available yet.</p>;
  }

  return (
    <form
      action={mergeOrphanAction}
      className="form-row"
      onSubmit={(event) => {
        const form = event.currentTarget;
        const selected = form.targetId as HTMLSelectElement;
        const label = selected.options[selected.selectedIndex]?.text ?? "this application";
        if (!window.confirm(`Merge ${orphan.company} into ${label}?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="orphanId" value={orphan.id} />
      <label className="field compact-field">
        <span>Merge into</span>
        <select name="targetId" required>
          <option value="">Choose an application</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.company}
              {target.role ? `, ${target.role}` : ""}
            </option>
          ))}
        </select>
      </label>
      <button className="danger-button" type="submit">
        Merge orphan
      </button>
    </form>
  );
}
