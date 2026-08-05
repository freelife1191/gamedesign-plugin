const modes = new Set(["required", "all", "select", "prompt-only"]);

function codexAvailable(capability) {
  return capability === true || capability?.available === true;
}

export function resolveImageProvider({ mode, apiKeyPresent, codexCapability } = {}) {
  if (!modes.has(mode)) throw new Error("Image generation mode is not allowed.");
  if (mode === "prompt-only") return { provider: "none", reason: "prompt-only" };
  if (mode === "select") return { provider: "none", reason: "selection-required" };
  if (apiKeyPresent === true) return { provider: "openai", reason: "api-key-present" };
  if (codexAvailable(codexCapability)) return { provider: "codex", reason: "codex-capability-available" };
  return { provider: "unavailable", reason: "no-provider-available" };
}
