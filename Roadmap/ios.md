# iOS roadmap

Paprism currently ships and supports Android only. This document records the
work required for iOS; it is not a claim that the current project builds or is
ready for distribution on iPhone.

## 1. Project and distribution setup

- Reserve a stable iOS bundle identifier and add the Expo `ios` configuration.
- Split the Android APK profile from a platform-neutral EAS production profile.
- Add EAS Submit configuration only after an Apple Developer account and App
  Store Connect application exist.
- Keep TestFlight as the first distribution target; App Store publication is a
  later release step.

## 2. Platform adapters and assets

- Keep Android Storage Access Framework and intent launching in an Android
  implementation.
- Add an iOS implementation that downloads into the application sandbox and
  opens the system share sheet for Save to Files, Books, and AirDrop.
- Prepare separate full app icon, adaptive Android foreground, splash mark, and
  favicon assets instead of using one bitmap for every platform role.
- Review user-facing download wording so it follows each platform's conventions.

## 3. Simulator and real-device acceptance

- Verify Safe Area layout on small, notched, and Dynamic Island devices.
- Regress feed paging, abstract scrolling, rapid gestures, and reduced motion.
- Verify SecureStore persistence, provider editing, native Markdown, equations,
  tables, figures, external links, Ask streaming, chat persistence, and optional
  semantic retrieval.
- Verify offline reader packages, cancellation, PDF sharing, airplane-mode
  reading, dark appearance, and dynamic text sizes.
- Treat a real iPhone pass as required; Simulator success alone is insufficient
  for gestures, file sharing, and secure storage.

## 4. TestFlight and store readiness

- Add a privacy policy covering arXiv requests, local data, SecureStore keys,
  and paper text sent directly to user-selected translation, Ask, and embedding
  providers.
- Prepare App Store screenshots, support URL, age rating, privacy declarations,
  review notes, and export-compliance answers.
- Upload an internal TestFlight build, complete the device matrix, then request
  external beta review before considering a public App Store release.
