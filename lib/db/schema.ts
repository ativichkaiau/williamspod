import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
} from "drizzle-orm/sqlite-core";

// Users — multi-tenant identities. Display names are case-preserved for the UI;
// `nameLower` is the normalized form used for lookups and uniqueness.
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    nameLower: text("name_lower").notNull().unique(),
    role: text("role", { enum: ["admin", "member"] })
      .notNull()
      .default("member"),
    // PBKDF2-SHA256 packed as `pbkdf2$<iter>$<saltHex>$<hashHex>`.
    passhash: text("passhash").notNull(),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("users_archived_idx").on(t.archivedAt)],
);

// Single-use invite codes that authorize signup. Admin generates, friend redeems.
export const invites = sqliteTable(
  "invites",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    note: text("note"), // optional label, e.g. "for Aaron"
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    usedById: text("used_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("invites_code_idx").on(t.code),
    index("invites_creator_idx").on(t.createdById),
  ],
);

// Lectures = the curated organizational unit. One Excel sheet = one lecture.
// SHARED across all users — only admins can write.
// `subject` groups lectures into exam sets (e.g. "HNS-2", "HEN-2"); free-text
// so admins can add new exam sets without code changes.
export const lectures = sqliteTable(
  "lectures",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    subject: text("subject"),
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
  (t) => [
    index("lectures_order_idx").on(t.orderIndex),
    index("lectures_subject_idx").on(t.subject),
  ],
);

// Questions belong to a lecture. Choices stored as JSON for flexibility.
// Shared bank — only admins can write.
export const questions = sqliteTable(
  "questions",
  {
    id: text("id").primaryKey(),
    lectureId: text("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "cascade" }),
    stem: text("stem").notNull(),
    choices: text("choices", { mode: "json" }).$type<string[]>().notNull(),
    correctIndex: integer("correct_index").notNull(),
    explanation: text("explanation"),
    topic: text("topic"),
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

// Question variants — AI-generated re-framings of a base question that test
// the SAME concept from a different angle. Additive: the base question is never
// modified. `provider` records how it was produced; provenance is baseQuestionId.
export const questionVariants = sqliteTable(
  "question_variants",
  {
    id: text("id").primaryKey(),
    baseQuestionId: text("base_question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    angle: text("angle", {
      enum: [
        "recall",
        "mechanism",
        "clinical_vignette",
        "physical_exam",
        "diagnosis",
        "management",
        "trap",
        "integration",
      ],
    }).notNull(),
    difficulty: text("difficulty", {
      enum: ["easier", "same", "harder"],
    }).notNull(),
    stem: text("stem").notNull(),
    choices: text("choices", { mode: "json" }).$type<string[]>().notNull(),
    correctIndex: integer("correct_index").notNull(),
    explanation: text("explanation"),
    learningObjective: text("learning_objective"),
    conceptTag: text("concept_tag"),
    provider: text("provider").notNull(),
    model: text("model"),
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("question_variants_base_idx").on(t.baseQuestionId)],
);

// An attempt = one WilliamsPod training run. Now scoped to a user.
// userId is nullable to allow backfilling legacy single-user data via the
// setup-admin script; once backfilled all new rows always set it.
export const attempts = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    label: text("label"),
    mode: text("mode", { enum: ["full", "lecture", "weak", "custom"] }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    timeUsedMs: integer("time_used_ms"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    lectureIds: text("lecture_ids", { mode: "json" }).$type<string[]>().notNull(),
    questionCount: integer("question_count").notNull(),
    scoreCorrect: integer("score_correct"),
    scoreTotal: integer("score_total"),
    integrityFlagCount: integer("integrity_flag_count").notNull().default(0),
    aborted: integer("aborted", { mode: "boolean" }).notNull().default(false),
    abortReason: text("abort_reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("attempts_started_idx").on(t.startedAt),
    index("attempts_user_idx").on(t.userId),
  ],
);

// Per-question state inside an attempt.
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
    questionOrder: integer("question_order").notNull(),
    shownChoices: text("shown_choices", { mode: "json" })
      .$type<number[]>()
      .notNull(),
    pickedShownIndex: integer("picked_shown_index").notNull().default(-1),
    isCorrect: integer("is_correct", { mode: "boolean" }),
    markedForReview: integer("marked_for_review", { mode: "boolean" })
      .notNull()
      .default(false),
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
    elapsedMs: integer("elapsed_ms").notNull(),
    detail: text("detail"),
  },
  (t) => [index("integrity_events_attempt_idx").on(t.attemptId)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
export type Lecture = typeof lectures.$inferSelect;
export type NewLecture = typeof lectures.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type QuestionVariantRow = typeof questionVariants.$inferSelect;
export type NewQuestionVariantRow = typeof questionVariants.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type AttemptAnswer = typeof attemptAnswers.$inferSelect;
export type NewAttemptAnswer = typeof attemptAnswers.$inferInsert;
export type IntegrityEvent = typeof integrityEvents.$inferSelect;
export type NewIntegrityEvent = typeof integrityEvents.$inferInsert;
