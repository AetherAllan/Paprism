# ArxivTok

TikTok-style vertical feed for arXiv papers. **Android-first**, no backend — each device talks to arXiv directly.

## How it works

- Calls `https://export.arxiv.org/api/query` (official API, not HTML scraping)
- **Rate limit:** serial requests, minimum **3 seconds** between starts (arXiv ToU)
- **Optimistic prefetch:** loads **30 papers** per page; when ≤ **12** remain ahead of the current card, queues the next page in the background
- Open Abstract / PDF via system browser / PDF viewer
- **Motion:** Reanimated scroll-linked scale/opacity/parallax, staggered card enter, ambient orbs, spring buttons, loading choreography

## Run (Android)

Package manager: **Bun**

```bash
bun install
bun start
# then press `a`, or:
bun run android
```

Needs Android SDK (`ANDROID_HOME`), `adb`, and a device/emulator with network access to `export.arxiv.org`.

### Android SDK (already set up on this machine)

```bash
# env is in ~/.zshrc; or for this shell:
source scripts/android-env.sh

# start emulator (first boot is slow)
emulator -avd ArxivTok_API35 &

# then
bun run android
```

SDK root: `/opt/homebrew/share/android-commandlinetools`  
AVD: `ArxivTok_API35` (Pixel 7 / API 35)

## Project layout

```
src/
  lib/arxiv.ts          # fetch + Atom XML parse + rate limiter wiring
  lib/rateLimiter.ts    # 3s gap, single-flight queue
  hooks/usePaperFeed.ts # page buffer + prefetch trigger
  components/PaperCard.tsx
  components/PaperFeed.tsx
  types/paper.ts
```

Default category: `cs.LG` (change in `App.tsx`).
