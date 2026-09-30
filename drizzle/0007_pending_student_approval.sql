ALTER TABLE `users` MODIFY COLUMN `status` enum('pending','active','inactive','suspended') NOT NULL DEFAULT 'active';
