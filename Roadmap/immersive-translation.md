# Native immersive reader

Paprism fetches `https://arxiv.org/html/{id}`, parses the LaTeXML HTML into its own versioned `PaperDocument`, and renders native React Native views. Remote paper HTML is treated as data; no script or page code is executed.

## Data flow

1. `paperSource.ts` downloads a bounded HTML response through the shared arXiv rate limiter.
2. `arxivHtmlParser.ts` extracts stable blocks: headings, paragraphs, lists, quotes, equations, tables, figures, and code.
3. Inline formulas and link targets become protected markers before translation, then are restored only when every marker survives exactly once.
4. The reader loads the saved semantic block ID with the document and starts the first `FlatList` render at that block. It does not render the summary first and race a corrective scroll against Markdown layout.
5. `PaperViewer.tsx` virtualizes the remaining blocks and requests visible translations plus a small forward window.
6. Offline downloads store `document.json` and referenced figures only. Version-1 HTML packages are parsed locally for backward compatibility.

## Translation behavior

- Modes: source, bilingual, and translation-only.
- Paragraphs are the smallest translation unit; batches never cross section boundaries.
- Each request includes the paper title, current section, and a short previous-paragraph context. Context is not repeated per block.
- Requests are capped by characters and output tokens. Cache identity includes the paper revision, parsed source hash, target language, provider, endpoint, and model.
- Google is a built-in keyless option. OpenRouter and OpenAI-compatible services use user-supplied keys kept in encrypted device storage.
- Formulas, Markdown structure, and link destinations must survive translation unchanged.

## Reader guarantees

- Native text selection and accessibility semantics.
- Native LaTeX rendering; no WebView fallback.
- Reading positions use stable block IDs instead of document-wide pixel offsets and are updated as the visible block changes.
- Internal table-of-contents links scroll to parsed block anchors.
- Unsupported or unavailable arXiv HTML shows explicit retry, PDF, and arXiv fallbacks.
- Online paper content, offline files, and model output are never trusted as executable instructions.

## Out of scope

- Parsing raw TeX source. arXiv HTML is the supported structured input.
- PDF text extraction, OCR, video, or image translation.
- Hosted translation proxy or application-owned premium API key.

## Main files

- `src/features/viewer/arxivHtmlParser.ts`
- `src/features/viewer/paperDocument.ts`
- `src/features/viewer/PaperViewer.tsx`
- `src/features/viewer/readerPosition.ts`
- `src/features/viewer/useDocumentTranslation.ts`
- `src/features/viewer/translator.ts`
- `src/features/library/offlinePaper.ts`
