import { NextResponse } from "next/server";
import { z } from "zod";
import { INTEGRITY_ABORT_THRESHOLD, findAttemptForUser, recordIntegrityEvent } from "@/lib/attempts";
import { apiAuth } from "@/lib/auth";

const Body = z.object({
  kind: z.enum([
    "blur",
    "visibility_hidden",
    "fullscreen_exit",
    "copy",
    "paste",
    "context_menu",
    "nav_block",
    "shortcut_block",
  ]),
  elapsedMs: z.number().int().min(0),
  detail: z.string().max(500).nullable().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await apiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const attempt = await findAttemptForUser(id, auth.user.id);
  if (!attempt) return NextResponse.json({ error: "not found" }, { status: 404 });
  const result = await recordIntegrityEvent({
    attemptId: id,
    kind: parsed.data.kind,
    elapsedMs: parsed.data.elapsedMs,
    detail: parsed.data.detail ?? null,
  });
  return NextResponse.json({
    ok: true,
    total: result.total,
    recorded: result.recorded,
    abortThreshold: INTEGRITY_ABORT_THRESHOLD,
    shouldAbort: result.recorded && result.total >= INTEGRITY_ABORT_THRESHOLD,
  });
}
