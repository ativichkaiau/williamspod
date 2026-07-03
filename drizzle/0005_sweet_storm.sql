CREATE TABLE `question_telemetry` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`user_id` text,
	`question_id` text NOT NULL,
	`original_question_id` text,
	`variant_id` text,
	`lecture_id` text,
	`subject` text,
	`question_type` text NOT NULL,
	`selected_index` integer DEFAULT -1 NOT NULL,
	`correct_index` integer NOT NULL,
	`is_correct` integer NOT NULL,
	`time_taken_ms` integer DEFAULT 0 NOT NULL,
	`click_count` integer DEFAULT 0 NOT NULL,
	`answer_change_count` integer DEFAULT 0 NOT NULL,
	`revisit_count` integer DEFAULT 0 NOT NULL,
	`confidence` integer,
	`timing_category` text,
	`error_type` text,
	`trap_type` text,
	`attempted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `question_telemetry_attempt_idx` ON `question_telemetry` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `question_telemetry_user_idx` ON `question_telemetry` (`user_id`);--> statement-breakpoint
CREATE INDEX `question_telemetry_question_idx` ON `question_telemetry` (`question_id`);