CREATE TABLE `advisers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `advisers_id` PRIMARY KEY(`id`),
	CONSTRAINT `advisers_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(255);--> statement-breakpoint
ALTER TABLE `projects` ADD `adviserId` int;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_name_unique` UNIQUE(`name`);--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_adviserId_advisers_id_fk` FOREIGN KEY (`adviserId`) REFERENCES `advisers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `projects_adviserId_idx` ON `projects` (`adviserId`);