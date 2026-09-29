ALTER TABLE `users` ADD `schoolId` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `yearSection` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_schoolId_unique` UNIQUE(`schoolId`);
