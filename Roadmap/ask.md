# Ask and semantic retrieval

Paprism Ask is implemented for the Android native reader. It answers questions from the current paper without a Paprism account or backend; requests go directly to the chat, embedding, and optional web-search services selected by the user.

## Implemented

- [x] Open Ask from the reader or from Android native text selection.
- [x] Keep translation and Ask selections independent while reusing the same OpenRouter and OpenAI-compatible provider profiles.
- [x] Stream assistant text into the native Markdown renderer. If a compatible endpoint explicitly rejects streaming or React Native cannot expose response chunks, retry once without streaming.
- [x] Persist per-paper messages, sources, drafts, selection state, chat position, and interrupted/error status in local SQLite.
- [x] Build bounded context from the selected passage, visible paper block, recent messages, and relevant paper chunks.
- [x] Support an optional, separately configured embedding provider. Vectors are created lazily and isolated by normalized endpoint and model; failure falls back to normal paper context.
- [x] Attach paper passage citations and OpenRouter web citations. Web search is opt-in per message and is unavailable for generic compatible APIs.
- [x] Keep API keys in SecureStore and expose only a saved-key placeholder in settings.
- [x] Clear one paper conversation or all Ask chats and paper indexes with confirmation and explicit success/error feedback.

## Current boundaries

- Ask is enabled only in the Android reader until the iOS acceptance work in [`ios.md`](ios.md) is complete.
- There is no hosted Paprism model proxy, account sync, cross-device chat history, or automatic indexing of the whole library.
- Embedding is optional. Ask must remain usable with bounded normal context when retrieval is missing or fails.
- Web search is an OpenRouter-specific opt-in and may incur provider charges.

## Main files

- `src/features/ask/AskSheet.tsx`
- `src/features/ask/useAskConversation.ts`
- `src/features/ask/askClient.ts`
- `src/features/ask/askCore.ts`
- `src/features/ask/askRag.ts`
- `src/features/ask/askDatabase.ts`
- `src/features/ask/embeddingProviders.ts`
- `src/features/settings/useProviderProfiles.ts`
