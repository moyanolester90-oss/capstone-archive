# Capstone Archive

A capstone project archive system for BSIT students at GWC Inc. — students browse and request approved capstone projects, advisers upload and manage their students' work, and admins/librarians review, approve, and manage the collection.

## Stack

- **Frontend:** React 19 + Vite + TailwindCSS v4 + shadcn/radix UI
- **Backend:** Node.js + Express + tRPC
- **Database:** MySQL via Drizzle ORM
- **Auth:** Credential-based (School ID + password) login per role (student / adviser / admin)

## Features

- Role-based portals for students, advisers, and admins
- Capstone project upload, review, and approval workflow
- Bookmarks/favorites for students
- Download request workflow (students request, admins approve, advisers can then download)
- View-only, protected PDF viewing (no download button, no direct file URL, copy/print/screenshot deterrence)
- Duplicate-account prevention (School ID and Name checked at signup, both frontend and backend)
- Normalized schema (1NF/2NF/3NF) with a dedicated `advisers` lookup table

## Getting started

```bash
npm install --legacy-peer-deps
cp .env.example .env   # fill in your DATABASE_URL and other secrets
npm run db:push        # generate and run Drizzle migrations
npm run dev             # start the dev server
```

## Project structure

```
client/     React frontend (pages, components)
server/     Express + tRPC backend, auth, business logic
drizzle/    Database schema and migrations
shared/     Types and constants shared between client and server
```
