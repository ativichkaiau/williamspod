CREATE TABLE `question_stats` (
	`question_id` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`sum_time_ms` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`question_id` text NOT NULL,
	`subject` text,
	`lecture_id` text,
	`reps` integer DEFAULT 0 NOT NULL,
	`ease` integer DEFAULT 2500 NOT NULL,
	`interval_days` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`last_correct` integer,
	`due_at` integer NOT NULL,
	`last_reviewed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_user_due_idx` ON `review_schedule` (`user_id`,`due_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `review_user_question_idx` ON `review_schedule` (`user_id`,`question_id`);