"use client";

import { Check } from "lucide-react";
import {
  disciplines,
  priorities,
  type Priority,
  type UserContext,
} from "@/lib/schemas";

const labels: Record<string, string> = {
  developer: "Developer",
  designer: "Designer",
  writer: "Writer",
  marketer: "Marketer",
  consultant: "Consultant",
  other: "Other",
  under_50k: "Under ₹50,000",
  "50k_2l": "₹50,000–₹2 lakh",
  "2l_10l": "₹2–₹10 lakh",
  over_10l: "Over ₹10 lakh",
  india: "India",
  international: "International",
  draft: "Draft — not signed",
  signed: "Already signed",
  prompt_payment: "Prompt payment",
  ip_ownership: "IP ownership",
  portfolio_rights: "Portfolio rights",
  scope_control: "Scope control",
  flexible_exit: "Flexible exit",
  liability_protection: "Liability protection",
};

export function ContextForm({
  context,
  onChange,
  compact = false,
}: {
  context: UserContext;
  onChange: (context: UserContext) => void;
  compact?: boolean;
}) {
  const togglePriority = (priority: Priority) => {
    if (context.priorities.includes(priority)) {
      if (context.priorities.length === 2) return;
      onChange({ ...context, priorities: context.priorities.filter((item) => item !== priority) });
      return;
    }
    const next = [...context.priorities, priority].slice(-2) as [Priority, Priority];
    onChange({ ...context, priorities: next });
  };

  return (
    <div className={compact ? "context-form context-form--compact" : "context-form"}>
      <div className="form-grid">
        <label>
          <span>Your work</span>
          <select
            value={context.discipline}
            onChange={(event) =>
              onChange({ ...context, discipline: event.target.value as UserContext["discipline"] })
            }
          >
            {disciplines.map((item) => (
              <option value={item} key={item}>{labels[item]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Contract value</span>
          <select
            value={context.contractValue}
            onChange={(event) =>
              onChange({ ...context, contractValue: event.target.value as UserContext["contractValue"] })
            }
          >
            {["under_50k", "50k_2l", "2l_10l", "over_10l"].map((item) => (
              <option value={item} key={item}>{labels[item]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Client</span>
          <select
            value={context.clientLocation}
            onChange={(event) =>
              onChange({ ...context, clientLocation: event.target.value as UserContext["clientLocation"] })
            }
          >
            {(["india", "international"] as const).map((item) => (
              <option value={item} key={item}>{labels[item]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Contract stage</span>
          <select
            value={context.status}
            onChange={(event) =>
              onChange({ ...context, status: event.target.value as UserContext["status"] })
            }
          >
            {(["draft", "signed"] as const).map((item) => (
              <option value={item} key={item}>{labels[item]}</option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend>Choose two priorities</legend>
        <div className="priority-grid">
          {priorities.map((priority) => {
            const selected = context.priorities.includes(priority);
            return (
              <button
                key={priority}
                type="button"
                className={selected ? "priority-chip priority-chip--selected" : "priority-chip"}
                aria-pressed={selected}
                onClick={() => togglePriority(priority)}
              >
                {selected && <Check size={14} aria-hidden="true" />}
                {labels[priority]}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
