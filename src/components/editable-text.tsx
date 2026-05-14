"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null;
  onSave: (next: string | null) => Promise<void>;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  /** If true, an empty value reverts to null. If false, empty becomes "". */
  emptyAsNull?: boolean;
  ariaLabel?: string;
};

const baseClasses =
  "block w-full bg-transparent text-inherit outline-none placeholder:text-neutral-400 focus:rounded focus:bg-neutral-50 focus:px-2 focus:py-0.5 focus:ring-1 focus:ring-neutral-300 dark:placeholder:text-neutral-600 dark:focus:bg-neutral-900 dark:focus:ring-neutral-700";

export function EditableText({
  value,
  onSave,
  placeholder,
  className,
  multiline = false,
  emptyAsNull = true,
  ariaLabel,
}: Props) {
  const [val, setVal] = useState(value ?? "");
  const [, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (multiline && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [multiline, val]);

  function handleBlur() {
    const trimmed = val;
    const next = emptyAsNull && trimmed.trim() === "" ? null : trimmed;
    if (next === value) return;
    startTransition(async () => {
      try {
        await onSave(next);
      } catch (err) {
        setVal(value ?? "");
        console.error("EditableText: save failed, reverted.", err);
      }
    });
  }

  if (multiline) {
    return (
      <textarea
        ref={textareaRef}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={1}
        className={cn(baseClasses, "resize-none overflow-hidden", className)}
      />
    );
  }

  return (
    <input
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={cn(baseClasses, className)}
    />
  );
}
