import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";

// Lectures = the user's organizational unit. One Excel sheet = one lecture.
export const lectures = sqliteTable(
  "lectures",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    orderIndex: integer("order_index").notNull().default(0),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("lectures_order_idx").on(t.orderIndex)],
);

// Questions belong to a lecture. Choices stored as JSON for flexibility.
export const questions = sqliteTable(
  "questions",
  {
    id: text("id").primaryKey(),
    lectureId: text("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "cascade" }),
    stem: text("stem").notNull(),
    // JSON-encoded array of strings, e.g. ["choice A", "choice B", ...]
    choices: text("choices", { mode: "json" }).$type<string[]>().notNull(),
    // Index of correct choice in the ORIGINAL choices array (0-based).
    correctIndex: integer("correct_index").notNull(),
    explanation: text("explanation"),
    topic: text("topic"),
    // 1 = easy, 2 = medium, 3 = hard, nullable if unknown.
    difficulty: integer("difficulty"),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("questions_lecture_idx").on(t.lectureId),
    index("questions_topic_idx").on(t.topic),
  ],
);

// An attempt = one WilliamsPod training run.
export const attempts = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    label: text("label"),
    mode: text("mode", { enum: ["full", "lecture", "weak", "custom"] }).notNull(),
    // ms allotted for the whole run
    durationMs: integer("duration_ms").notNull(),
    // ms actually used (set on submit)
    timeUsedMs: integer("time_used_ms"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    // Snapshot of selected lecture ids (JSON array)
    lectureIds: text("lecture_ids", { mode: "json" }).$type<string[]>().notNull(),
    // Snapshot of question count target
    questionCount: integer("question_count").notNull(),
    // Final score = correct / total
    scoreCorrect: integer("score_correct"),
    scoreTotal: integer("score_total"),
    // Cached number of integrity_events for quick listing
    integrityFlagCount: integer("integrity_flag_count").notNull().default(0),
    // If true, attempt was aborted (window closed, integrity threshold exceeded, etc.)
    aborted: integer("aborted", { mode: "boolean" }).notNull().default(false),
    abortReason: text("abort_reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("attempts_started_idx").on(t.startedAt)],
);

// Per-question state inside an attempt.
// shownChoices = the permutation of choices presented to the user (indices into the original choices array).
// pickedShownIndex = the user's pick, as an index into shownChoices.
// We derive correctness on submit and store it for fast queries.
export const attemptAnswers = sqliteTable(
  "attempt_answers",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    // Display order within this attempt (0-based)
    questionOrder: integer("question_order").notNull(),
    // JSON array of indices into question.choices, in display order
    shownChoices: text("shown_choices", { mode: "json" })
      .$type<number[]>()
      .notNull(),
    // -1 if unanswered
    pickedShownIndex: integer("picked_shown_index").notNull().default(-1),
    isCorrect: integer("is_correct", { mode: "boolean" }),
    markedForReview: integer("marked_for_review", { mode: "boolean" })
      .notNull()
      .default(false),
    // ms spent on this question (best-effort, accumulated)
    timeOnQuestionMs: integer("time_on_question_ms").notNull().default(0),
  },
  (t) => [
    index("attempt_answers_attempt_idx").on(t.attemptId),
    index("attempt_answers_question_idx").on(t.questionId),
  ],
);

// Integrity events captured during hard lockdown.
export const integrityEvents = sqliteTable(
  "integrity_events",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: [
        "blur",
        "visibility_hidden",
        "fullscreen_exit",
        "copy",
        "paste",
        "context_menu",
        "nav_block",
        "shortcut_block",
      ],
    }).notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    // ms since attempt start, useful for replaying
    elapsedMs: integer("elapsed_ms").notNull(),
    detail: text("detail"),
  },
  (t) => [index("integrity_events_attempt_idx").on(t.attemptId)],
);

export type Lecture = typeof lectures.$inferSelect;
export type NewLecture = typeof lectures.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type AttemptAnswer = typeof attemptAnswers.$inferSelect;
export type NewAttemptAnswer = typeof attemptAnswers.$inferInsert;
export type IntegrityEvent = typeof integrityEvents.$inferSelect;
export type NewIntegrityEvent = typeof integrityEvents.$inferInsert;
