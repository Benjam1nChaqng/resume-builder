"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null;
  onSave: (next: string | null) => Promise<void>;
  className?: string;
  ariaLabel?: string;
  /** When true, the input is rendered but disabled (e.g. endDate when current). */
  disabled?: boolean;
};

export function EditableDate({ value, onSave, className, ariaLabel, disabled }: Props) {
  const [val, setVal] = useState(value ?? "");
  const [, startTransition] = useTransition();

  function handleBlur() {
    const next = val === "" ? null : val;
    if (next === value) return;
    startTransition(async () => {
      try {
        await onSave(next);
      } catch (err) {
        setVal(value ?? "");
        console.error("EditableDate: save failed, reverted.", err);
      }
    });
  }

  return (
    <input
      type="date"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleBlur}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "block bg-transparent text-inherit outline-none focus:rounded focus:bg-neutral-50 focus:px-2 focus:py-0.5 focus:ring-1 focus:ring-neutral-300 disabled:opacity-50 dark:focus:bg-neutral-900 dark:focus:ring-neutral-700",
        className,
      )}
    />
  );
}
