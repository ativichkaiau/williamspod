import { NextResponse } from "next/server";
import { z } from "zod";

import { apiAuth } from "@/lib/auth";
import {
  hubSubjects,
  mapHubBank,
  type HubBankFeed,
  type HubIndexEntry,
} from "@/lib/hub-import";
import { importLecturesIntoBank } from "@/lib/import-bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_HUB_BASE_URL =
  process.env.WILLIAMSHUB_URL ?? "https://williamshub.vercel.app";

const ImportBody = z.object({
  baseUrl: z.string().trim().min(1).optional(),
  hubUrl: z.string().trim().min(1).optional(),
  questionBankUrl: z.string().trim().min(1).optional(),
  searchIndexUrl: z.string().trim().min(1).optional(),
  subject: z.string().trim().min(1).max(80).nullable().optional(),
  mode: z.enum(["merge", "replace"]).default("merge"),
  dryRun: z.boolean().default(false),
});

type ImportBodyInput = z.infer<typeof ImportBody>;

interface FeedUrls {
  baseUrl: string;
  questionBankUrl: string;
  searchIndexUrl: string;
}

function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

function parseAbsoluteUrl(raw: string, label: string): string {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("URL must start with http:// or https://");
    }
    return url.toString();
  } catch (err) {
    throw new Error(`${label}: ${(err as Error).message}`);
  }
}

function resolveFeedUrls(input: Partial<ImportBodyInput>): FeedUrls {
  const baseUrl = parseAbsoluteUrl(
    (input.baseUrl ?? input.hubUrl ?? DEFAULT_HUB_BASE_URL).replace(/\/+$/, ""),
    "baseUrl",
  );
  return {
    baseUrl,
    questionBankUrl: input.questionBankUrl
      ? parseAbsoluteUrl(input.questionBankUrl, "questionBankUrl")
      : new URL("/question-bank.json", baseUrl).toString(),
    searchIndexUrl: input.searchIndexUrl
      ? parseAbsoluteUrl(input.searchIndexUrl, "searchIndexUrl")
      : new URL("/search-index.json", baseUrl).toString(),
  };
}

async function fetchJson<T>(url: string, label: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`${label} responded ${res.status}`);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`${label} did not return JSON`);
  }
}

function summarize(lectures: { questions: unknown[]; subject: string | null }[]) {
  const bySubject = new Map<string, { lectures: number; questions: number }>();
  for (const lecture of lectures) {
    const key = lecture.subject ?? "Ungrouped";
    const current = bySubject.get(key) ?? { lectures: 0, questions: 0 };
    current.lectures += 1;
    current.questions += lecture.questions.length;
    bySubject.set(key, current);
  }
  return {
    lectures: lectures.length,
    questions: lectures.reduce((sum, lecture) => sum + lecture.questions.length, 0),
    bySubject: Object.fromEntries([...bySubject.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };
}

export async function GET(req: Request) {
  const auth = await apiAuth({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const subject = url.searchParams.get("subject");
  let feedUrls: FeedUrls;
  try {
    feedUrls = resolveFeedUrls({
      baseUrl: url.searchParams.get("baseUrl") ?? undefined,
      hubUrl: url.searchParams.get("hubUrl") ?? undefined,
      questionBankUrl: url.searchParams.get("questionBankUrl") ?? undefined,
      searchIndexUrl: url.searchParams.get("searchIndexUrl") ?? undefined,
    });
  } catch (err) {
    return jsonError((err as Error).message, 400);
  }

  try {
    const index = await fetchJson<HubIndexEntry[]>(feedUrls.searchIndexUrl, "Hub search index");
    if (!subject) {
      return NextResponse.json({
        ok: true,
        baseUrl: feedUrls.baseUrl,
        subjects: hubSubjects(index),
      });
    }

    const feed = await fetchJson<HubBankFeed>(feedUrls.questionBankUrl, "Hub question bank");
    const mapped = mapHubBank(feed, index, subject);
    return NextResponse.json({
      ok: true,
      baseUrl: feedUrls.baseUrl,
      subject,
      subjects: hubSubjects(index),
      preview: summarize(mapped),
    });
  } catch (err) {
    return jsonError((err as Error).message, 502);
  }
}

export async function POST(req: Request) {
  const auth = await apiAuth({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const parsed = ImportBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return jsonError("bad request", 400, parsed.error.issues);
  }

  let feedUrls: FeedUrls;
  try {
    feedUrls = resolveFeedUrls(parsed.data);
  } catch (err) {
    return jsonError((err as Error).message, 400);
  }

  try {
    const [feed, index] = await Promise.all([
      fetchJson<HubBankFeed>(feedUrls.questionBankUrl, "Hub question bank"),
      fetchJson<HubIndexEntry[]>(feedUrls.searchIndexUrl, "Hub search index"),
    ]);
    const mapped = mapHubBank(feed, index, parsed.data.subject ?? null);
    const preview = summarize(mapped);

    if (mapped.length === 0) {
      return jsonError("Hub feed mapped to zero importable lectures", 422, {
        subject: parsed.data.subject ?? null,
        subjects: hubSubjects(index),
      });
    }

    if (parsed.data.dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        baseUrl: feedUrls.baseUrl,
        subject: parsed.data.subject ?? null,
        mode: parsed.data.mode,
        preview,
      });
    }

    const inserted = await importLecturesIntoBank(mapped, {
      mode: parsed.data.mode,
    });

    return NextResponse.json({
      ok: true,
      baseUrl: feedUrls.baseUrl,
      subject: parsed.data.subject ?? null,
      mode: parsed.data.mode,
      preview,
      inserted,
    });
  } catch (err) {
    return jsonError((err as Error).message, 502);
  }
}
