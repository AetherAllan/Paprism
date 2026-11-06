const { withMainApplication } = require("expo/config-plugins");

const IMPORT = "import androidx.appcompat.app.AppCompatDelegate";
const CALL =
  "AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)";

/**
 * expo-system-ui applies `userInterfaceStyle` from an Activity lifecycle
 * callback. React Native has already read the configuration by then to colour
 * the navigation bar, so a release build draws a light bar on a dark app. Debug
 * builds hide this: the dev launcher Activity runs first and sets the mode.
 * Setting it when the Application starts makes it true for every later window.
 */
function addEarlyNightMode(contents) {
  if (contents.includes(CALL)) return contents;

  const importAnchor = /^import android\.app\.Application$/m;
  const callAnchor = /^(\s*)super\.onCreate\(\)$/m;
  if (!importAnchor.test(contents)) {
    throw new Error("withEarlyNightMode could not find the Application import");
  }
  if (!callAnchor.test(contents)) {
    throw new Error("withEarlyNightMode could not find super.onCreate()");
  }

  return contents
    .replace(importAnchor, (line) => `${line}\n${IMPORT}`)
    .replace(callAnchor, (line, indent) => `${line}\n${indent}${CALL}`);
}

function withEarlyNightMode(config) {
  if (config.userInterfaceStyle !== "dark") return config;
  return withMainApplication(config, (result) => {
    if (result.modResults.language !== "kt") {
      throw new Error(
        "withEarlyNightMode only supports Kotlin MainApplication",
      );
    }
    result.modResults.contents = addEarlyNightMode(result.modResults.contents);
    return result;
  });
}

module.exports = withEarlyNightMode;
module.exports.addEarlyNightMode = addEarlyNightMode;
