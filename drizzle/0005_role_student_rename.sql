ALTER TABLE `users` MODIFY COLUMN `role` enum('user','student','adviser','admin') NOT NULL DEFAULT 'student';--> statement-breakpoint
UPDATE `users` SET `role` = 'student' WHERE `role` = 'user';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('student','adviser','admin') NOT NULL DEFAULT 'student';
