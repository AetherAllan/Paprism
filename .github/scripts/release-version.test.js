const { describe, expect, test } = require("bun:test");
const { nextVersion } = require("./release-version");

describe("nextVersion", () => {
  test("bumps each supported semantic version component", () => {
    expect(nextVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(nextVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(nextVersion("1.2.3", "major")).toBe("2.0.0");
  });

  test("keeps the current version when retrying a failed release", () => {
    expect(nextVersion("1.2.3", "retry")).toBe("1.2.3");
  });

  test("rejects unsupported actions and non-stable versions", () => {
    expect(() => nextVersion("1.2.3", "preview")).toThrow(
      "Unknown release action",
    );
    expect(() => nextVersion("1.2.3-beta.1", "patch")).toThrow(
      "Expected a stable semantic version",
    );
  });
});
