-- ============================================================
-- Capstone Archive — normalization migration (run on LOCAL capstone_archive only)
-- ============================================================

-- Step 1: merge duplicate adviser records.
-- advisers table currently has 3 rows for the same real person, just spelled
-- differently ("JOHN VIANNEY V. MANUEL", "Mr. John Vianney V. Manuel",
-- "Mr. John Vianney Manuel"). Keep id 2 (the most complete/correct spelling)
-- as the single canonical row, repoint every project to it, then remove the
-- 2 duplicate rows.
UPDATE `projects` SET `adviserId` = 2 WHERE `adviserId` IN (1, 3);
DELETE FROM `advisers` WHERE `id` IN (1, 3);

-- Step 2: enforce the relationship properly (every project must reference a
-- real adviser row; deleting an adviser is blocked rather than silently
-- orphaning projects).
ALTER TABLE `projects`
  MODIFY COLUMN `adviserId` int NOT NULL,
  ADD CONSTRAINT `projects_adviserId_advisers_id_fk`
    FOREIGN KEY (`adviserId`) REFERENCES `advisers` (`id`) ON DELETE RESTRICT;

-- Step 3: create a proper junction table for project members instead of a
-- single newline-delimited text blob (1NF: one value per column).
CREATE TABLE `projectMembers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `projectId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `projectMembers_projectId_idx` (`projectId`),
  CONSTRAINT `projectMembers_projectId_projects_id_fk`
    FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 4: migrate the existing members text into individual rows.
INSERT INTO `projectMembers` (`projectId`, `name`, `sortOrder`) VALUES
(1, 'CALONGE, JEHOSAPHAT D.', 0),
(1, 'PIOQUINTO, JEREMY L.', 1),
(1, 'CARDENAS, ANGEL R.', 2),
(1, 'TAGARA, PHINKIE R.', 3),
(1, 'REYES, MATTHEW B.', 4),
(1, 'DAYRITH, MELANIE V.', 5),
(1, 'BRAVO, JERICHO P.', 6),
(2, 'Duguinay, Gonoroso III C.', 0),
(2, 'Ganaden, Cherry Ann D.', 1),
(2, 'Ballaros Markshano G.', 2),
(2, 'Ballado, Rogelio R.', 3),
(2, 'Bernal, Jovolyn U.', 4),
(2, 'Corbillon, AJ A.', 5),
(3, 'Neil Mathew  R Aquino', 0),
(3, 'Alexis Mae A Dela Cruz', 1),
(3, 'Kazandra R Tugade', 2),
(3, 'Julius S Ferrer', 3),
(4, 'Mark Darwin R. Garcia', 0),
(4, 'Ducusin Jay C.', 1),
(4, 'Janna Bright L. Escano', 2),
(4, 'Limuel S. Uson', 3),
(5, 'Josh Rangel', 0),
(5, 'Lia Jill Dela Cuesta', 1),
(5, 'Samatha Kaye Delos Santos', 2),
(5, 'James Patric Miranda', 3),
(7, 'addsa', 0);

-- Step 5: drop the now-redundant free-text columns. The app code (updated
-- separately) reads the adviser name via adviserId -> advisers.name, and
-- the members list via the projectMembers table, so these columns are no
-- longer used anywhere.
ALTER TABLE `projects`
  DROP COLUMN `adviser`,
  DROP COLUMN `members`;
