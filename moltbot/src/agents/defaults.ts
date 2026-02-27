// Defaults for agent metadata when upstream does not supply them.
// Model id uses pi-ai's built-in Anthropic catalog.
export const DEFAULT_PROVIDER = "google";
export const DEFAULT_MODEL = "gemini-1.5-flash";
// Context window: Opus 4.5 supports ~200k tokens (per pi-ai models.generated.ts).
export const DEFAULT_CONTEXT_TOKENS = 200_000;
