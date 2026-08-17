import {
  isAgentErrorResponse,
  requireAgentRequest,
} from "@/lib/agent/http";
import {
  buildResumePdfFilename,
  loadResumeExportJob,
} from "@/lib/resumes/export";
import { loadRenderableResume } from "@/lib/resumes/render";
import { renderResumePdf } from "@/lib/resumes/resume-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const access = await requireAgentRequest(request);
  if (isAgentErrorResponse(access)) return access;

  const { id } = await params;
  const data = await loadRenderableResume(id);
  if (!data || data.userId !== access.userId) {
    return new Response("Not found", { status: 404 });
  }

  const jobContext = await loadResumeExportJob(id, access.userId);
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
