/**
 * Tests for credential sign-up/sign-in (School ID + password), which replaced
 * Google OAuth and demo login. Runs against a temporary database (see
 * server/test/setup.ts).
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { COOKIE_NAME } from "../shared/const";

function ctxFor(user: TrpcContext["user"] | null) {
  const cookies: Record<string, string> = {};
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string) => { cookies[name] = value; },
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
  return { ctx, cookies };
}

describe("student sign-up", () => {
  it("creates the account, signs it in, and never returns a password hash", async () => {
    const { ctx, cookies } = ctxFor(null);
    const result = await appRouter.createCaller(ctx).auth.signupStudent({
      schoolId: "202400001", password: "SuperSecret1", name: "Juan Dela Cruz", yearSection: "4th Year - BSIT 401",
    });
    expect(result.success).toBe(true);
    expect(cookies[COOKIE_NAME]).toBeTruthy();

    const created = await db.getUserBySchoolId("202400001");
    expect(created?.role).toBe("student");
    expect(created?.yearSection).toBe("4th Year - BSIT 401");

    const me: any = await appRouter.createCaller(ctxFor(created as any).ctx).auth.me();
    expect(me.passwordHash).toBeUndefined();
  });

  it("rejects a duplicate School ID", async () => {
    await appRouter.createCaller(ctxFor(null).ctx).auth.signupStudent({
      schoolId: "202400002", password: "SuperSecret1", name: "A Dupe Id", yearSection: "1st Year",
    });
    await expect(
      appRouter.createCaller(ctxFor(null).ctx).auth.signupStudent({
        schoolId: "202400002", password: "AnotherPass1", name: "B Dupe Id", yearSection: "2nd Year",
      })
    ).rejects.toThrow(/existing account/);
  });

  it("rejects a duplicate Name, even under a different School ID or role", async () => {
    await appRouter.createCaller(ctxFor(null).ctx).auth.signupStudent({
      schoolId: "202400103", password: "SuperSecret1", name: "Duplicate Name", yearSection: "1st Year",
    });
    await expect(
      appRouter.createCaller(ctxFor(null).ctx).auth.signupStudent({
        schoolId: "202400104", password: "AnotherPass1", name: "Duplicate Name", yearSection: "2nd Year",
      })
    ).rejects.toThrow(/existing account/);
    // Case/whitespace-insensitive, and blocked across roles too.
    await expect(
      appRouter.createCaller(ctxFor(null).ctx).auth.signupStaff({
        schoolId: "202400105", password: "AnotherPass1", name: "  duplicate name  ",
        email: "dup@gwc.edu.ph", role: "adviser",
      })
    ).rejects.toThrow(/existing account/);
  });

  it("checkAvailability reports a taken School ID or Name before submit", async () => {
    await appRouter.createCaller(ctxFor(null).ctx).auth.signupStudent({
      schoolId: "202400106", password: "SuperSecret1", name: "Availability Check", yearSection: "1st Year",
    });
    const caller = appRouter.createCaller(ctxFor(null).ctx);
    expect(await caller.auth.checkAvailability({ schoolId: "202400106" })).toMatchObject({ available: false, schoolIdTaken: true });
    expect(await caller.auth.checkAvailability({ name: "Availability Check" })).toMatchObject({ available: false, nameTaken: true });
    expect(await caller.auth.checkAvailability({ schoolId: "202499999", name: "Nobody Yet" })).toMatchObject({ available: true });
  });
});

describe("adviser/librarian sign-up", () => {
  it("saves exactly the role chosen on the form, for every self sign-up", async () => {
    const first = await appRouter.createCaller(ctxFor(null).ctx).auth.signupStaff({
      schoolId: "1000001", password: "SuperSecret1", name: "First Librarian", email: "lib1@gwc.edu.ph", role: "admin",
    });
    expect(first.success).toBe(true);
    expect((await db.getUserBySchoolId("1000001"))?.role).toBe("admin");

    const second = await appRouter.createCaller(ctxFor(null).ctx).auth.signupStaff({
      schoolId: "1000002", password: "SuperSecret1", name: "Second Librarian", email: "lib2@gwc.edu.ph", role: "admin",
    });
    expect(second.success).toBe(true);
    expect((await db.getUserBySchoolId("1000002"))?.role).toBe("admin");
  });

  it("an adviser sign-up is never upgraded", async () => {
    await appRouter.createCaller(ctxFor(null).ctx).auth.signupStaff({
      schoolId: "1000003", password: "SuperSecret1", name: "Adviser Only", email: "adv@gwc.edu.ph", role: "adviser",
    });
    expect((await db.getUserBySchoolId("1000003"))?.role).toBe("adviser");
  });
});

describe("credential sign-in", () => {
  it("signs in on the matching portal and refuses a different one", async () => {
    await appRouter.createCaller(ctxFor(null).ctx).auth.signupStudent({
      schoolId: "202400003", password: "SuperSecret1", name: "Login Test", yearSection: "3rd Year",
    });

    const { ctx, cookies } = ctxFor(null);
    const ok = await appRouter.createCaller(ctx).auth.login({ schoolId: "202400003", password: "SuperSecret1", portal: "student" });
    expect(ok.success).toBe(true);
    expect(cookies[COOKIE_NAME]).toBeTruthy();

    await expect(
      appRouter.createCaller(ctxFor(null).ctx).auth.login({ schoolId: "202400003", password: "SuperSecret1", portal: "adviser" })
    ).rejects.toThrow(/Student account/);
  });

  it("refuses an incorrect password without revealing which part was wrong", async () => {
    await appRouter.createCaller(ctxFor(null).ctx).auth.signupStudent({
      schoolId: "202400004", password: "SuperSecret1", name: "Wrong Pass", yearSection: "1st Year",
    });
    await expect(
      appRouter.createCaller(ctxFor(null).ctx).auth.login({ schoolId: "202400004", password: "totallyWrong", portal: "student" })
    ).rejects.toThrow(/Incorrect School ID or password/);
  });

  it("refuses an unknown School ID with the same generic message", async () => {
    await expect(
      appRouter.createCaller(ctxFor(null).ctx).auth.login({ schoolId: "no-such-id", password: "whatever1", portal: "student" })
    ).rejects.toThrow(/Incorrect School ID or password/);
  });
});
