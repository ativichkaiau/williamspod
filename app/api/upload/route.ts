import { NextResponse } from "next/server";
import { apiAuth } from "@/lib/auth";
import { parseWorkbook } from "@/lib/excel";
import { importLecturesIntoBank } from "@/lib/import-bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await apiAuth({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }
  const file = form.get("file");
  const mode = (form.get("mode") as string | null) ?? "merge"; // "merge" | "replace"
  const subjectRaw = (form.get("subject") as string | null) ?? null;
  const subject = subjectRaw && subjectRaw.trim() !== "" ? subjectRaw.trim().slice(0, 80) : null;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing 'file' field" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty file" }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "file too large (max 20MB)" }, { status: 413 });
  }
  const buf = await file.arrayBuffer();
  let parsed;
  try {
    parsed = parseWorkbook(buf);
  } catch (err) {
    return NextResponse.json(
      { error: `parse failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  if (parsed.lectures.length === 0) {
    return NextResponse.json(
      { error: "no valid sheets found", details: parsed.errors },
      { status: 422 },
    );
  }

  const inserted = await importLecturesIntoBank(parsed.lectures, {
    mode: mode === "replace" ? "replace" : "merge",
    subject,
  });

  return NextResponse.json({
    ok: true,
    inserted,
    warnings: parsed.errors,
  });
}
