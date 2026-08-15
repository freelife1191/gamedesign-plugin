const modes = new Set(["required", "all", "select", "prompt-only"]);
const providerPreferences = new Set(["codex-first", "openai"]);
const embeddedTextLocales = new Set(["none", "ko-KR"]);

function codexAvailable(capability) {
  if (capability === true) return true;
  if (!capability || typeof capability !== "object") return false;
  if (Object.hasOwn(capability, "status")) {
    if (!["available", "unavailable", "unknown"].includes(capability.status)) {
      throw new Error("Image capability status is not allowed.");
    }
    return capability.status === "available";
  }
  return capability.available === true;
}

export function resolveImageProvider({
  mode,
  providerPreference = "codex-first",
  embeddedTextLocale = "none",
  model = "gpt-image-2",
  apiKeyPresent,
  codexCapability,
} = {}) {
  if (!modes.has(mode)) throw new Error("Image generation mode is not allowed.");
  if (!providerPreferences.has(providerPreference)) throw new Error("Image provider preference is not allowed.");
  if (!embeddedTextLocales.has(embeddedTextLocale)) throw new Error("Image embedded text locale is not allowed.");
  if (mode === "prompt-only") return { provider: "none", reason: "prompt-only" };
  if (embeddedTextLocale === "ko-KR") {
    if (providerPreference !== "openai") return { provider: "unavailable", reason: "korean-text-requires-openai" };
    if (model !== "gpt-image-2") return { provider: "unavailable", reason: "korean-text-requires-gpt-image-2" };
    if (apiKeyPresent !== true) return { provider: "unavailable", reason: "openai-api-key-required" };
    return { provider: "openai", reason: "korean-text-openai-required" };
  }
  if (providerPreference === "openai") {
    return apiKeyPresent === true
      ? { provider: "openai", reason: "openai-explicit" }
      : { provider: "unavailable", reason: "openai-api-key-required" };
  }
  if (codexAvailable(codexCapability)) return { provider: "codex", reason: "codex-capability-available" };
  if (codexCapability?.status === "unknown") return { provider: "unavailable", reason: "codex-capability-unknown" };
  if (apiKeyPresent === true) return { provider: "unavailable", reason: "paid-openai-opt-in-required" };
  return { provider: "unavailable", reason: "no-provider-available" };
}
