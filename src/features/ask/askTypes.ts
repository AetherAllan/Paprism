import type { ProviderProfile } from "@/features/settings/providerCore";

export type AskSelection = {
  arxivId: string;
  blockId: string;
  text: string;
  sourceText: string;
  sectionTitle?: string;
  language: "source" | "translation";
};

export type AskMessageStatus =
  "complete" | "pending" | "streaming" | "interrupted" | "error";

export type AskMessage = {
  id: string;
  arxivId: string;
  role: "user" | "assistant";
  content: string;
  status: AskMessageStatus;
  createdAt: number;
};

export type AskSource = {
  id: number;
  messageId: string;
  kind: "selection" | "paper" | "web";
  title: string;
  url?: string;
  quote?: string;
  blockId?: string;
};

export type AskThread = {
  arxivId: string;
  draft: string;
  selection: AskSelection | null;
  chatOffset: number;
};

export type EmbeddingProfile = Omit<ProviderProfile, "kind"> & {
  kind: "openrouter" | "openai-compatible";
};

export type ReadingState = {
  arxivId: string;
  feedOffset: number;
  readerBlockId: string | null;
};

export type AskChunk = {
  id: string;
  blockId: string;
  ordinal: number;
  sectionTitle?: string;
  text: string;
};
