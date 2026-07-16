# Release & APK distribution

Open-source sideload via GitHub Releases. See [`.github/workflows/release.yml`](../.github/workflows/release.yml).

## Packaging baseline

Universal APK from EAS is ~**79 MB** (four CPU ABIs bundled). App source and assets are tiny; bulk is React Native + native deps.

## Implemented plan

- [x] One Gradle release build creates `arm64-v8a`, `armeabi-v7a`, `x86_64`, and universal APKs.
- [x] A local Expo config plugin injects the ABI split block and fails if the generated Gradle template changes unexpectedly.
- [x] EAS uploads all four APKs as one build-artifact archive.
- [x] GitHub Actions extracts, renames, verifies signatures/package/version/ABIs, and uploads all four release assets.
- [x] A manual `Run workflow` action bumps the semantic version in `package.json`, verifies the resolved Expo version, builds on EAS, and creates the immutable tag only after APK verification.
- [x] The app reads its installed version from Expo config and checks GitHub's latest stable Release once per launch with a 15-second timeout.
- [x] Available updates appear as red dots on the home menu and About entry; About links to the GitHub Release rather than downloading or installing an APK.
- [x] Failed update checks do not retry automatically. The user can explicitly check again from About.
- [ ] Compress [`assets/AndroidLogo.png`](../assets/AndroidLogo.png) separately after visual comparison; do not trade icon quality for an unmeasured APK saving.

## Notes

- One `eas build` per manual release run = one build job (not one per ABI).
- Most physical devices should use `arm64-v8a`; emulators usually use `x86_64`; universal is the compatibility fallback.
- The first EAS build was verified against the downloaded artifact archive; future dependency or SDK upgrades can still change sizes.
- `package.json` is the single user-facing semantic version source. `app.config.js` derives Expo's public version from it, while EAS increments Android `versionCode` independently.

## Local release measurement

SDK 57 `assembleRelease` produced:

| APK         | ABIs                                | Size  |
| ----------- | ----------------------------------- | ----- |
| arm64-v8a   | arm64-v8a                           | 31 MB |
| armeabi-v7a | armeabi-v7a                         | 25 MB |
| x86_64      | x86_64                              | 31 MB |
| universal   | arm64-v8a, armeabi-v7a, x86, x86_64 | 75 MB |

EAS artifacts may differ slightly because cloud signing and tool versions can change packaging.

## EAS release measurement

A pre-rebrand EAS build (`06a684ed-963e-46d4-8412-9c19339331d7`) produced version `1.0.0` (`versionCode` 3). The downloaded archive passed signature, package-name, version, APK-count, and native-ABI checks. The build remains in the retired EAS project, so this document keeps the measurement without linking to the old project.

| APK         |      Bytes | Display size |
| ----------- | ---------: | -----------: |
| arm64-v8a   | 31,981,776 |        31 MB |
| armeabi-v7a | 26,131,688 |        25 MB |
| x86_64      | 32,410,482 |        31 MB |
| universal   | 78,698,968 |        75 MB |
