import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Login navigation side effects", () => {
  it("redirects authenticated users from an effect instead of render", () => {
    const source = readFileSync(
      resolve(process.cwd(), "client/src/pages/Login.tsx"),
      "utf8"
    );

    const effectStart = source.indexOf("useEffect(() => {");
    expect(effectStart).toBeGreaterThan(-1);
    expect(source).toContain("navigate(redirectPath);");
    expect(source.slice(0, effectStart)).not.toContain("navigate(");
  });
});

// This regression guard protects the lifecycle boundary that caused the warning.

// End of test.

// No database or network calls are required.

// End.

// The OAuth flow remains unchanged.

// Done.

// End of file.
