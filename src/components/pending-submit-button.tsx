"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function PendingSubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: ComponentProps<typeof Button> & {
  children: ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} disabled={disabled || pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
