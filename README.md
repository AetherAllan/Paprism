<p align="center">
  <img src="assets/MainConcept.png" alt="ArxivTok" width="420" />
</p>

# ArxivTok

TikTok-style vertical feed for [arXiv](https://arxiv.org) papers. **Android-first**, no backend — each device talks to arXiv directly.

## Features

- Vertical swipe through paper cards (title, authors, abstract)
- Category multi-select (**AND** intersection on the API query)
- Built-in HTML reader (`arxiv.org/html/...`) with optional Google Translate
- Library: saved, history, PDF downloads (app storage + Android SAF)
- UI languages: English / 中文 (follows system or manual)

## How it works

- Official Atom API: `https://export.arxiv.org/api/query`
- **Rate limit:** serial requests, ≥ **3s** between starts (arXiv ToU)
- **Prefetch:** 30 papers per page; when ≤ 12 remain ahead, the next page loads in the background

## Run

Requires [Bun](https://bun.sh) and an Android device/emulator with network access to `export.arxiv.org`.

```bash
bun install
bun start
# then press `a`, or:
bun run android
```

Typecheck:

```bash
bun run typecheck
```

## Project layout

Feature-first layout — find code by product area:

```
App.tsx                 # thin shell: providers + compose features
src/
  features/
    feed/               # swipe feed, cards, prefetch hook
    library/            # saved / history / downloads
    viewer/             # HTML WebView reader
    categories/         # picker UI + i18n labels
    settings/           # language prefs
  shared/hooks/         # cross-feature hooks (e.g. useAppPrefs)
  lib/                  # arxiv client, rate limiter, prefs storage, taxonomy
  i18n/                 # en / zh strings
  types/
```

## License

[MIT](LICENSE) © 2026 AetherAllan
