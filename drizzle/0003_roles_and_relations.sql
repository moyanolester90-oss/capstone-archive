ALTER TABLE `users` MODIFY COLUMN `role` enum('user','adviser','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `fileType` varchar(100);--> statement-breakpoint
ALTER TABLE `bookmarks` ADD CONSTRAINT `bookmarks_user_project_unique` UNIQUE(`userId`,`projectId`);--> statement-breakpoint
ALTER TABLE `downloadRequests` ADD CONSTRAINT `downloadRequests_user_project_unique` UNIQUE(`userId`,`projectId`);--> statement-breakpoint
CREATE INDEX `activityLogs_createdAt_idx` ON `activityLogs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `downloadRequests_status_idx` ON `downloadRequests` (`status`);--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `projects_categoryId_idx` ON `projects` (`categoryId`);--> statement-breakpoint
CREATE INDEX `projects_uploadedBy_idx` ON `projects` (`uploadedBy`);--> statement-breakpoint
CREATE INDEX `projects_schoolYear_idx` ON `projects` (`schoolYear`);--> statement-breakpoint
ALTER TABLE `activityLogs` ADD CONSTRAINT `activityLogs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookmarks` ADD CONSTRAINT `bookmarks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookmarks` ADD CONSTRAINT `bookmarks_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `downloadRequests` ADD CONSTRAINT `downloadRequests_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `downloadRequests` ADD CONSTRAINT `downloadRequests_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_uploadedBy_users_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;
