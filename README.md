<p align="center">
  <img src="assets/MainConcept.png" alt="ArxivTok" width="420" />
</p>

# ArxivTok

TikTok-style vertical feed for [arXiv](https://arxiv.org) papers. **Android-first**, no backend — each device talks to arXiv directly.

## Features

- Vertical swipe through paper cards (title, authors, abstract)
- Category multi-select (**AND** intersection on the API query)
- Online arXiv search across all papers or the current category selection
- Online and packaged offline HTML reader with lazy in-page bilingual translation
- BYOK OpenRouter / OpenAI-compatible profiles; keys use encrypted device storage
- Library: saved, history, offline HTML, and PDF downloads (app storage + Android SAF)
- UI languages: English / 中文 (follows system or manual)

## How it works

- Official Atom API: `https://export.arxiv.org/api/query`
- **Rate limit:** serial requests, ≥ **3s** between starts (arXiv ToU)
- **Prefetch:** 20 papers per page; when 4 remain ahead, the next page loads in the background

## Run

Requires [Bun](https://bun.sh) and an Android device/emulator with network access to `export.arxiv.org`.

```bash
bun install
bun run dev
# then press `a`, or:
bun run android
```

Checks:

```bash
bun test
bun run typecheck
```

## Project layout

Feature-first layout — find code by product area:

```
index.ts
Roadmap/
src/
  App.tsx
  features/
    feed/
    library/
    viewer/
    categories/
    settings/
  shared/
  lib/
  i18n/
  types/
```

## Release (Android APK)

CI **only** runs on a `v*` git tag (or manual “Run workflow”), not on every push to `main`.

1. Bump `version` in `app.json` and `package.json`
2. One-time: add repo secret `EXPO_TOKEN` ([Expo access token](https://expo.dev/settings/access-tokens))
3. One-time (local, creates Android keystore on EAS if missing):

```bash
bunx eas-cli build -p android --profile production
```

4. Tag and push **the tag**:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Workflow: [`.github/workflows/release.yml`](.github/workflows/release.yml). A single EAS build produces four GitHub Release assets:

- `arm64-v8a`: mainstream physical Android devices
- `armeabi-v7a`: older 32-bit devices
- `x86_64`: emulators and x86 devices
- `universal`: compatibility fallback, largest download

## Roadmap

Planned work lives in [`Roadmap/`](Roadmap/):

| Doc | Topic |
|-----|--------|
| [immersive-translation.md](Roadmap/immersive-translation.md) | In-WebView bilingual translation (Immersive Translate–style); multi-engine, no Google proxy |
| [release.md](Roadmap/release.md) | ABI-specific APKs and release artifact verification |

## License

[MIT](LICENSE) © 2026 AetherAllan
