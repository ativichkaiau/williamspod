ALTER TABLE `lectures` ADD `subject` text;--> statement-breakpoint
CREATE INDEX `lectures_subject_idx` ON `lectures` (`subject`);