import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ALLOWED_TYPES = [
  // Images
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic",
  // Video
  "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska",
  // Audio
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/aac", "audio/x-m4a",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

// POST /api/upload
// Vercel Blob client-upload handler — called twice by @vercel/blob/client:
//   1. phase "generate-client-token": returns a short-lived upload token
//   2. phase "upload-completed": confirmation callback after upload finishes
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCENT") {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_TYPES,
        maximumSizeInBytes: 500 * 1024 * 1024, // 500 MB
      }),
      onUploadCompleted: async ({ blob }) => {
        // Blob URL is returned to the client and saved by the form handler
        console.log("[upload] completed:", blob.url);
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    console.error("[POST /api/upload]", err);
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
