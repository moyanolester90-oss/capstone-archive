CREATE TABLE `editRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`adminNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `editRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `editRequests_user_project_unique` UNIQUE(`userId`,`projectId`)
);
--> statement-breakpoint
CREATE INDEX `editRequests_status_idx` ON `editRequests` (`status`);
--> statement-breakpoint
ALTER TABLE `editRequests` ADD CONSTRAINT `editRequests_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `editRequests` ADD CONSTRAINT `editRequests_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
