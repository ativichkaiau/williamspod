import { notFound, redirect } from "next/navigation";
import { loadAttemptForRuntime } from "@/lib/attempts";
import { requireUser } from "@/lib/auth";
import { ExamRuntime } from "./exam-runtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pod run — WilliamsPod" };

export default async function PodRuntimePage(
  props: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await props.params;
  const user = await requireUser();
  const loaded = await loadAttemptForRuntime(attemptId, user.id);
  if (!loaded) notFound();
  if (loaded.attempt.submittedAt) {
    redirect(`/run/${attemptId}/debrief`);
  }
  return (
    <ExamRuntime
      attemptId={attemptId}
      durationMs={loaded.attempt.durationMs}
      startedAtMs={new Date(loaded.attempt.startedAt).getTime()}
      questions={loaded.questions.map((q) => ({
        id: q.id,
        stem: q.stem,
        displayChoices: q.displayChoices,
        recommendedSec: q.recommendedSec ?? null,
        type: q.type ?? null,
      }))}
      initialPicks={Object.fromEntries(
        loaded.answers.map((a) => [a.questionId, a.pickedShownIndex]),
      )}
      initialMarked={Object.fromEntries(
        loaded.answers.map((a) => [a.questionId, a.markedForReview]),
      )}
    />
  );
}
