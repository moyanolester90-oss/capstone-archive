# Capstone Archive — TODO

## Done (September 2026 review)
- [x] Browse search: filter fields for author, year, features, and research
- [x] Upload form: reject project titles containing emojis
- [x] Fix React warning: Login navigated during render (moved into an effect)
- [x] Close login backdoor: `dev_` codes and `?email=` impersonation only work in local demo mode
- [x] Demo login only when not in production and Google keys are not set (Demo Admin / Demo Student buttons)
- [x] Visitors are no longer signed in automatically as admin
- [x] Suspended / inactive users are blocked at sign-in and lose access immediately
- [x] Admins cannot remove their own admin role or deactivate themselves; at least one active admin is kept
- [x] Recent activity feed is admin-only
- [x] "My Submissions" page: status, rejection reason, edit & resubmit
- [x] In-app notifications (bell): approvals/rejections for students, new items to review for admins
- [x] Upload: 50 MB limit enforced (browser + server), file type checked by extension (Windows ZIP fix), change/remove file
- [x] Deleting a project also removes its file, bookmarks and download requests
- [x] Categories that still have projects can't be deleted
- [x] Reject dialog closes properly; rejected projects can be approved later; delete asks for confirmation
- [x] Menu for phones/tablets (the header had no navigation on small screens)
- [x] local_db.json: safe saving (temp file + backup), no overwrite by a second server window
- [x] Tests use a temporary database instead of the real local_db.json
- [x] Removed broken analytics script and the OAUTH_SERVER_URL startup error

## Database & roles (September 2026)
- [x] MySQL database via Drizzle ORM (XAMPP): migrations, foreign keys, indexes; setup-database.bat imports local_db.json
- [x] Roles: Student (browse/search/favorites/download requests), Adviser (upload + update own capstones, reviewed by librarian), Admin/Librarian (approve, upload, update, delete, manage users)
- [x] Student protection: no printing, screenshots (Print Screen / snipping blur), copying, right-click, editing
- [x] Database viewer: open-database.bat (Drizzle Studio) or phpMyAdmin

## Role logins, scanner, sign-up (September 2026)
- [x] Separate Login portals (Student / Adviser / Librarian) with per-role dashboards
- [x] Admin-only hard-copy-to-PDF document scanner (camera capture or imported photos)
- [x] Sign Up pages: Student (School ID, password, name, year & section) and Adviser/Librarian (School ID, password, name, school email)
- [x] Google sign-in and demo login removed entirely — sign-in is School ID + password only
- [x] Self sign-up can only create the very first Librarian account; later ones sign up as Adviser and are promoted from Users
- [x] School seal used as the header logo and as a large blurred watermark on the Login/Sign Up pages

## Still to do (needs your input)
- [ ] Run `setup-database.bat` (once) to connect the real MySQL database, then restart with `run-system.bat`
- [ ] Set a long random `JWT_SECRET` in `.env` before deploying
- [ ] Sign up your real accounts from `/signup` — the old demo accounts (Demo Admin/Adviser/student) can no longer sign in
