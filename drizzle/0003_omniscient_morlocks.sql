CREATE TABLE `question_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`base_question_id` text NOT NULL,
	`angle` text NOT NULL,
	`difficulty` text NOT NULL,
	`stem` text NOT NULL,
	`choices` text NOT NULL,
	`correct_index` integer NOT NULL,
	`explanation` text,
	`learning_objective` text,
	`concept_tag` text,
	`provider` text NOT NULL,
	`model` text,
	`created_by_id` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`base_question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `question_variants_base_idx` ON `question_variants` (`base_question_id`);