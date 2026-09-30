/**
 * Tests for the security and feature fixes: private activity feed, admin
 * self-lockout protection, suspended accounts, upload rules, My Submissions /
 * resubmit, cascade deletes, category protection and notifications.
 * Runs against a temporary database (see server/test/setup.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Request } from "express";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME } from "../shared/const";

type User = NonNullable<TrpcContext["user"]>;

function ctxFor(user: User | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

async function makeUser(openId: string, role: "student" | "adviser" | "admin", name: string): Promise<User> {
  await db.upsertUser({ openId, name, email: `${openId}@test.local`, role, lastSignedIn: new Date() });
  const user = await db.getUserByOpenId(openId);
  if (!user) throw new Error("user not created");
  return user as User;
}

const pdfBase64 = Buffer.from("%PDF-1.4 test document").toString("base64");

let admin: User;
let admin2: User;
let student: User;
let otherStudent: User;
let adviser: User;
let otherAdviser: User;
let categoryId: number;

beforeAll(async () => {
  admin = await makeUser("t-admin", "admin", "Admin One");
  admin2 = await makeUser("t-admin-2", "admin", "Admin Two");
  student = await makeUser("t-student", "student", "Student One");
  otherStudent = await makeUser("t-student-2", "student", "Student Two");
  adviser = await makeUser("t-adviser", "adviser", "Adviser One");
  otherAdviser = await makeUser("t-adviser-2", "adviser", "Adviser Two");
  const created = await appRouter.createCaller(ctxFor(admin)).categories.create({ name: "Test Category" });
  categoryId = created.id!;
});

const validProject = () => ({
  title: "Smart Library System",
  abstract: "An abstract",
  categoryId,
  adviser: "Prof. Cruz",
  members: "A\nB",
  schoolYear: "2024-2025",
});

describe("admin lockout protection", () => {
  it("an admin cannot suspend themselves", async () => {
    await expect(
      appRouter.createCaller(ctxFor(admin)).users.updateStatus({ userId: admin.id, status: "suspended" })
    ).rejects.toThrow(/own/);
  });

  it("the last active admin cannot be deactivated", async () => {
    // suspend admin2 first, leaving `admin` as the only remaining active admin
    await appRouter.createCaller(ctxFor(admin)).users.updateStatus({ userId: admin2.id, status: "suspended" });
    // A (suspended) admin2 session can't act, but even a direct call must keep one active admin:
    const fakeActor = { ...admin2, id: 9999, role: "admin" as const };
    await expect(
      appRouter.createCaller(ctxFor(fakeActor)).users.updateStatus({ userId: admin.id, status: "inactive" })
    ).rejects.toThrow(/At least one active admin/);
    await appRouter.createCaller(ctxFor(admin)).users.updateStatus({ userId: admin2.id, status: "active" });
  });

  it("role is fixed at sign-up and cannot be changed by anyone, including admins — there is no updateRole endpoint", () => {
    expect((appRouter.createCaller(ctxFor(admin)).users as any).updateRole).toBeUndefined();
  });
});

describe("suspended accounts", () => {
  it("a suspended user's session is rejected", async () => {
    const token = await sdk.createSessionToken(otherStudent.openId, { name: "Student Two" });
    const req = { headers: { cookie: `${COOKIE_NAME}=${token}` } } as unknown as Request;

    const ok = await sdk.authenticateRequest(req);
    expect(ok.id).toBe(otherStudent.id);

    await appRouter.createCaller(ctxFor(admin)).users.updateStatus({ userId: otherStudent.id, status: "suspended" });
    await expect(sdk.authenticateRequest(req)).rejects.toThrow(/suspended/);

    await appRouter.createCaller(ctxFor(admin)).users.updateStatus({ userId: otherStudent.id, status: "active" });
    await expect(sdk.authenticateRequest(req)).resolves.toBeTruthy();
  });

  it("a session for an unknown user is rejected (no automatic admin accounts)", async () => {
    const token = await sdk.createSessionToken("someone-admin-not-in-db", { name: "X" });
    const req = { headers: { cookie: `${COOKIE_NAME}=${token}` } } as unknown as Request;
    await expect(sdk.authenticateRequest(req)).rejects.toThrow(/not found/);
    expect(await db.getUserByOpenId("someone-admin-not-in-db")).toBeUndefined();
  });
});

describe("upload rules", () => {
  it("rejects files that are not PDF, DOCX or ZIP", async () => {
    await expect(
      appRouter.createCaller(ctxFor(adviser)).projects.create({
        ...validProject(),
        fileData: { fileName: "virus.exe", fileType: "application/octet-stream", base64: pdfBase64 },
      })
    ).rejects.toThrow(/Only PDF, DOCX, ZIP/);
  });

  it("rejects files over 50 MB", async () => {
    const big = "A".repeat(Math.ceil((51 * 1024 * 1024 * 4) / 3));
    await expect(
      appRouter.createCaller(ctxFor(adviser)).projects.create({
        ...validProject(),
        fileData: { fileName: "big.pdf", fileType: "application/pdf", base64: big },
      })
    ).rejects.toThrow(/too large/);
  });

  it("accepts a Windows-style ZIP (application/x-zip-compressed)", async () => {
    const res = await appRouter.createCaller(ctxFor(adviser)).projects.create({
      ...validProject(),
      title: "Zip Project",
      fileData: { fileName: "source.zip", fileType: "application/x-zip-compressed", base64: pdfBase64 },
    });
    const project = await db.getProjectById(res.projectId!);
    expect(project?.fileType).toBe("application/zip");
  });

  it("rejects emoji titles, bad school years and unknown categories", async () => {
    const caller = appRouter.createCaller(ctxFor(adviser));
    await expect(caller.projects.create({ ...validProject(), title: "Cool App 🚀" })).rejects.toThrow(/emoji/);
    await expect(caller.projects.create({ ...validProject(), schoolYear: "2024-2027" })).rejects.toThrow(/School Year/);
    await expect(caller.projects.create({ ...validProject(), categoryId: 99999 })).rejects.toThrow(/valid category/);
  });
});

describe("roles: students browse only, advisers upload for review, librarian publishes", () => {
  it("students cannot upload, list uploads, or edit capstones", async () => {
    const studentCaller = appRouter.createCaller(ctxFor(student));
    await expect(studentCaller.projects.create(validProject())).rejects.toThrow(/advisers and the librarian/);
    await expect(studentCaller.projects.mine()).rejects.toThrow(/advisers and the librarian/);
    await expect(studentCaller.projects.resubmit({ id: 1, ...validProject() })).rejects.toThrow(/advisers and the librarian/);
    await expect(studentCaller.projects.update({ id: 1, title: "Hack" })).rejects.toThrow();
    await expect(studentCaller.projects.delete({ id: 1 })).rejects.toThrow();
    await expect(studentCaller.editRequests.create({ projectId: 1 })).rejects.toThrow(/only capstone advisers/i);
    // ...but they can browse and search
    await expect(studentCaller.projects.search({ query: "a" })).resolves.toBeInstanceOf(Array);
  });

  it("a librarian upload is published immediately", async () => {
    const res = await appRouter.createCaller(ctxFor(admin)).projects.create({ ...validProject(), title: "Librarian Upload" });
    expect(res.status).toBe("approved");
    expect((await db.getProjectById(res.projectId!))?.status).toBe("approved");
  });

  it("adviser upload -> rejected with reason -> fix & resubmit -> approved -> update goes back to review", async () => {
    const adviserCaller = appRouter.createCaller(ctxFor(adviser));
    const adminCaller = appRouter.createCaller(ctxFor(admin));

    const { projectId, status } = await adviserCaller.projects.create({
      ...validProject(),
      title: "Attendance Tracker",
      fileData: { fileName: "paper.pdf", fileType: "application/pdf", base64: pdfBase64 },
    });
    expect(status).toBe("pending");

    const mine = await adviserCaller.projects.mine();
    expect(mine.some(p => p.id === projectId && p.status === "pending")).toBe(true);
    expect((await appRouter.createCaller(ctxFor(otherAdviser)).projects.mine()).some(p => p.id === projectId)).toBe(false);
    // students can't see it while it's pending
    expect(await appRouter.createCaller(ctxFor(student)).projects.get({ id: projectId! })).toBeNull();

    await adminCaller.projects.reject({ id: projectId!, reason: "Please add the full abstract" });
    const rejected = (await adviserCaller.projects.mine()).find(p => p.id === projectId)!;
    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectionReason).toBe("Please add the full abstract");

    const notes = await adviserCaller.notifications.list();
    expect(notes.some(n => n.title.includes("not approved") && n.message.includes("full abstract"))).toBe(true);

    // another adviser can't update it
    await expect(
      appRouter.createCaller(ctxFor(otherAdviser)).projects.resubmit({ id: projectId!, ...validProject() })
    ).rejects.toThrow(/not found/i);

    // the project's own adviser can't edit it either, without the librarian's approval first
    await expect(
      adviserCaller.projects.resubmit({ id: projectId!, ...validProject() })
    ).rejects.toThrow(/approval/i);

    // request permission, get approved, then the edit goes through
    const { id: editReqId } = await adviserCaller.editRequests.create({ projectId: projectId! });
    expect((await adminCaller.notifications.list()).some(n => n.title === "New edit permission request")).toBe(true);
    await adminCaller.editRequests.approve({ id: editReqId! });
    expect((await adviserCaller.notifications.list()).some(n => n.title === "Edit permission approved")).toBe(true);

    const oldFileKey = rejected.fileKey!;
    await adviserCaller.projects.resubmit({
      id: projectId!,
      ...validProject(),
      title: "Attendance Tracker v2",
      abstract: "Full abstract now",
      fileData: { fileName: "paper-v2.pdf", fileType: "application/pdf", base64: pdfBase64 },
    });
    const resubmitted = (await db.getProjectById(projectId!))!;
    expect(resubmitted.status).toBe("pending");
    expect(resubmitted.rejectionReason ?? null).toBeNull();
    expect(resubmitted.title).toBe("Attendance Tracker v2");
    expect(resubmitted.fileName).toBe("paper-v2.pdf");
    expect(fs.existsSync(path.join(process.env.UPLOADS_DIR!, oldFileKey))).toBe(false);

    expect((await adminCaller.notifications.list()).some(n => n.title === "New project to review")).toBe(true);
    await adminCaller.projects.approve({ id: projectId! });
    expect((await adviserCaller.notifications.list()).some(n => n.title === "Your project was approved")).toBe(true);
    expect(await appRouter.createCaller(ctxFor(student)).projects.get({ id: projectId! })).not.toBeNull();

    // updating an approved capstone sends it back to the librarian
    await adviserCaller.projects.resubmit({ id: projectId!, ...validProject(), title: "Attendance Tracker v3" });
    expect((await db.getProjectById(projectId!))?.status).toBe("pending");
  });

  it("a role assigned at account creation stays fixed — nothing in the app can change it afterward", async () => {
    const s3 = await makeUser("t-student-3", "student", "Permanent Student");
    expect((await db.getUserById(s3.id))?.role).toBe("student");
    // There is no users.updateRole endpoint (or any other) that could change it.
    expect((appRouter.createCaller(ctxFor(admin)).users as any).updateRole).toBeUndefined();
  });
});

describe("delete clean-up and category protection", () => {
  it("deleting a project removes its file, bookmarks, download requests and edit requests", async () => {
    const adviserCaller = appRouter.createCaller(ctxFor(adviser));
    const adminCaller = appRouter.createCaller(ctxFor(admin));
    const { projectId } = await adviserCaller.projects.create({
      ...validProject(),
      title: "To Be Deleted",
      fileData: { fileName: "doc.pdf", fileType: "application/pdf", base64: pdfBase64 },
    });

    // download requests are only allowed for approved projects
    await expect(appRouter.createCaller(ctxFor(otherStudent)).downloadRequests.create({ projectId: projectId! })).rejects.toThrow();

    await adminCaller.projects.approve({ id: projectId! });
    await appRouter.createCaller(ctxFor(otherStudent)).bookmarks.toggle({ projectId: projectId! });
    await appRouter.createCaller(ctxFor(otherStudent)).downloadRequests.create({ projectId: projectId! });
    await adviserCaller.editRequests.create({ projectId: projectId! });

    const project = (await db.getProjectById(projectId!))!;
    const filePath = path.join(process.env.UPLOADS_DIR!, project.fileKey!);
    expect(fs.existsSync(filePath)).toBe(true);

    await adminCaller.projects.delete({ id: projectId! });

    expect(await db.getProjectById(projectId!)).toBeUndefined();
    expect(fs.existsSync(filePath)).toBe(false);
    expect((await db.getUserBookmarks(otherStudent.id)).some(p => p.id === projectId)).toBe(false);
    expect((await db.getUserDownloadRequests(otherStudent.id)).some(r => r.projectId === projectId)).toBe(false);
    expect((await db.getUserEditRequests(adviser.id)).some(r => r.projectId === projectId)).toBe(false);
  });

  it("a category that still has projects cannot be deleted", async () => {
    await expect(
      appRouter.createCaller(ctxFor(admin)).categories.delete({ id: categoryId })
    ).rejects.toThrow(/used by/);
    const empty = await appRouter.createCaller(ctxFor(admin)).categories.create({ name: "Empty Category" });
    await expect(appRouter.createCaller(ctxFor(admin)).categories.delete({ id: empty.id! })).resolves.toEqual({ success: true });
  });

  it("school year filter only lists approved projects", async () => {
    await appRouter.createCaller(ctxFor(adviser)).projects.create({ ...validProject(), title: "Hidden", schoolYear: "2030-2031" });
    const years = await appRouter.createCaller(ctxFor(null)).projects.schoolYears();
    expect(years).not.toContain("2030-2031");
  });
});
