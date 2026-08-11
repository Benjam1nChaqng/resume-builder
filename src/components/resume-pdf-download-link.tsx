"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ResumePdfDownloadLink({
  resumeId,
  className,
}: {
  resumeId: string;
  className?: string;
}) {
  const [started, setStarted] = useState(false);

  return (
    <a
      href={`/resume/${resumeId}/pdf`}
      className={cn("inline-flex min-w-32 items-center gap-1.5", className)}
      onClick={() => setStarted(true)}
    >
      <Download className="size-4" />
      <span role="status">{started ? "Download started" : "Download PDF"}</span>
    </a>
  );
}
