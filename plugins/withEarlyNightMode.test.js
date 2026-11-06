const { describe, expect, test } = require("bun:test");
const { addEarlyNightMode } = require("./withEarlyNightMode");

const TEMPLATE = `package com.paprism.app

import android.app.Application
import android.content.res.Configuration

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
  }
}
`;

describe("withEarlyNightMode", () => {
  test("sets night mode right after super.onCreate, exactly once", () => {
    const once = addEarlyNightMode(TEMPLATE);
    expect(addEarlyNightMode(once)).toBe(once);
    expect(once).toContain("import androidx.appcompat.app.AppCompatDelegate");
    expect(once).toContain(
      "    super.onCreate()\n    AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)\n    loadReactNative(this)",
    );
  });

  test("leaves the configuration callback alone", () => {
    expect(addEarlyNightMode(TEMPLATE)).toContain(
      "super.onConfigurationChanged(newConfig)\n  }",
    );
  });

  test("fails when the Expo template no longer has a clear insertion point", () => {
    expect(() => addEarlyNightMode("class MainApplication")).toThrow(
      "Application import",
    );
    expect(() =>
      addEarlyNightMode("import android.app.Application\nclass A"),
    ).toThrow("super.onCreate");
  });
});
