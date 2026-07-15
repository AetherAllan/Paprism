const { describe, expect, test } = require("bun:test");
const { addAbiSplits, setArchitectures } = require("./withAbiSplits");

describe("withAbiSplits", () => {
  test("adds all requested ABIs and a universal APK exactly once", () => {
    const input =
      'apply plugin: "com.android.application"\n\nandroid {\n    namespace "test"\n}\n';
    const once = addAbiSplits(input);
    const twice = addAbiSplits(once);
    expect(twice).toBe(once);
    expect(once).toContain('include "arm64-v8a", "armeabi-v7a", "x86_64"');
    expect(once).toContain("universalApk true");
  });

  test("fails when the Expo template no longer has one clear insertion point", () => {
    expect(() => addAbiSplits("plugins {}")).toThrow("found 0");
    expect(() => addAbiSplits("android { }\nandroid { }")).toThrow("found 2");
  });

  test("removes x86 from React Native native compilation", () => {
    const properties = [
      {
        type: "property",
        key: "reactNativeArchitectures",
        value: "armeabi-v7a,arm64-v8a,x86,x86_64",
      },
    ];
    expect(setArchitectures(properties)[0].value).toBe(
      "armeabi-v7a,arm64-v8a,x86_64",
    );
  });
});
