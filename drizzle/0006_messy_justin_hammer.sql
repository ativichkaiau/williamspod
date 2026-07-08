CREATE TABLE `mastery_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`key` text NOT NULL,
	`rating` integer DEFAULT 1000 NOT NULL,
	`races` integer DEFAULT 0 NOT NULL,
	`answered` integer DEFAULT 0 NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`last_delta` integer DEFAULT 0 NOT NULL,
	`history` text DEFAULT '[]' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mastery_user_idx` ON `mastery_ratings` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `mastery_user_scope_key_idx` ON `mastery_ratings` (`user_id`,`scope`,`key`);