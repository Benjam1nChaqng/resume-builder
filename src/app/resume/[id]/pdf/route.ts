import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { buildResumePdfFilename, loadResumeExportJob } from "@/lib/resumes/export";
import { renderResumePdf } from "@/lib/resumes/resume-pdf";
import { loadRenderableResume } from "@/lib/resumes/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const data = await loadRenderableResume(id);
  if (!data || data.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const jobContext = await loadResumeExportJob(id, session.user.id);
  const filename = buildResumePdfFilename({
    candidateName: data.contactInfo?.fullName ?? null,
    resumeTitle: data.title,
    jobContext,
  });
  const pdf = await renderResumePdf(data);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.byteLength),
      "Content-Type": "application/pdf",
    },
  });
}
