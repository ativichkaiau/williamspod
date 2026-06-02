CREATE TABLE `attempt_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`question_order` integer NOT NULL,
	`shown_choices` text NOT NULL,
	`picked_shown_index` integer DEFAULT -1 NOT NULL,
	`is_correct` integer,
	`marked_for_review` integer DEFAULT false NOT NULL,
	`time_on_question_ms` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempt_answers_attempt_idx` ON `attempt_answers` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `attempt_answers_question_idx` ON `attempt_answers` (`question_id`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text,
	`mode` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`time_used_ms` integer,
	`started_at` integer NOT NULL,
	`submitted_at` integer,
	`lecture_ids` text NOT NULL,
	`question_count` integer NOT NULL,
	`score_correct` integer,
	`score_total` integer,
	`integrity_flag_count` integer DEFAULT 0 NOT NULL,
	`aborted` integer DEFAULT false NOT NULL,
	`abort_reason` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attempts_started_idx` ON `attempts` (`started_at`);--> statement-breakpoint
CREATE TABLE `integrity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`kind` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`elapsed_ms` integer NOT NULL,
	`detail` text,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `integrity_events_attempt_idx` ON `integrity_events` (`attempt_id`);--> statement-breakpoint
CREATE TABLE `lectures` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lectures_slug_unique` ON `lectures` (`slug`);--> statement-breakpoint
CREATE INDEX `lectures_order_idx` ON `lectures` (`order_index`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`lecture_id` text NOT NULL,
	`stem` text NOT NULL,
	`choices` text NOT NULL,
	`correct_index` integer NOT NULL,
	`explanation` text,
	`topic` text,
	`difficulty` integer,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`lecture_id`) REFERENCES `lectures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `questions_lecture_idx` ON `questions` (`lecture_id`);--> statement-breakpoint
CREATE INDEX `questions_topic_idx` ON `questions` (`topic`);