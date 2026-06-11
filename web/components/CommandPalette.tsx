"use client";

import { useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";

export type PaletteApplication = {
  id: string;
  company: string;
  role: string | null;
  stage: string;
};

type Command = {
  id: string;
  group: "Applications" | "Views" | "Actions";
  label: string;
  hint?: string;
  href: string;
};

const viewCommands: { label: string; href: string }[] = [
  { label: "Go to Today", href: "/" },
  { label: "Go to Applications", href: "/?view=table" },
  { label: "Go to Board", href: "/?view=board" },
  { label: "Go to Flow", href: "/?view=flow" },
  { label: "Go to Follow-ups", href: "/?view=follow-ups" },
  { label: "Go to Insights", href: "/?view=insights" },
  { label: "Go to Performance", href: "/?view=performance" },
  { label: "Go to Network", href: "/?view=network" },
  { label: "Go to Assistant", href: "/?view=assistant" },
  { label: "Go to Profile", href: "/?view=profile" }
];

export default function CommandPalette({
  applications
}: {
  applications: PaletteApplication[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const commands = useMemo(() => buildCommands(query, applications), [query, applications]);

  function run(command: Command) {
    setOpen(false);
    router.push(command.href, { scroll: false });
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((current) => Math.min(current + 1, commands.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = commands[selected];
      if (command) {
        run(command);
      }
    }
  }

  return (
    <>
      <button className="cmdk-trigger" type="button" onClick={() => setOpen(true)}>
        <span>Search</span>
        <kbd>⌘K</kbd>
      </button>
      {open ? (
        <div className="cmdk-overlay" onClick={() => setOpen(false)}>
          <div
            aria-label="Command palette"
            aria-modal="true"
            className="cmdk-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <input
              aria-label="Command search"
              className="cmdk-input"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Jump to a company, switch views, or ask..."
              ref={inputRef}
              value={query}
            />
            <div aria-label="Commands" className="cmdk-list" role="listbox">
              {commands.length ? (
                commands.map((command, index) => (
                  <Fragment key={command.id}>
                    {index === 0 || commands[index - 1]!.group !== command.group ? (
                      <p className="cmdk-group-label">{command.group}</p>
                    ) : null}
                    <button
                      aria-selected={index === selected}
                      className={`cmdk-item${index === selected ? " selected" : ""}`}
                      onClick={() => run(command)}
                      onMouseEnter={() => setSelected(index)}
                      role="option"
                      type="button"
                    >
                      <span className="cmdk-item-label">{command.label}</span>
                      {command.hint ? <span className="cmdk-item-hint">{command.hint}</span> : null}
                    </button>
                  </Fragment>
                ))
              ) : (
                <p className="cmdk-empty">No matches.</p>
              )}
            </div>
            <div className="cmdk-footer">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span>esc close</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function buildCommands(query: string, applications: PaletteApplication[]): Command[] {
  const q = query.trim().toLowerCase();
  const result: Command[] = [];

  const matchedApplications = (
    q
      ? applications.filter((application) =>
          `${application.company} ${application.role ?? ""}`.toLowerCase().includes(q)
        )
      : applications
  ).slice(0, 6);
  for (const application of matchedApplications) {
    result.push({
      id: `application-${application.id}`,
      group: "Applications",
      label: application.role
        ? `${application.company} · ${application.role}`
        : application.company,
      hint: application.stage,
      href: `/?view=table&peek=${application.id}`
    });
  }

  const matchedViews = q
    ? viewCommands.filter((view) => view.label.toLowerCase().includes(q))
    : viewCommands;
  for (const view of matchedViews) {
    result.push({ id: view.href, group: "Views", label: view.label, href: view.href });
  }

  if (q.length > 2) {
    result.push({
      id: "ask-assistant",
      group: "Actions",
      label: `Ask assistant: "${query.trim()}"`,
      href: `/?view=assistant&ask=${encodeURIComponent(query.trim())}`
    });
  }

  return result;
}
