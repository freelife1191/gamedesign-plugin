const modes = new Set(["required", "all", "select", "prompt-only"]);

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

export function resolveImageProvider({ mode, apiKeyPresent, codexCapability } = {}) {
  if (!modes.has(mode)) throw new Error("Image generation mode is not allowed.");
  if (mode === "prompt-only") return { provider: "none", reason: "prompt-only" };
  if (apiKeyPresent === true) return { provider: "openai", reason: "api-key-present" };
  if (codexAvailable(codexCapability)) return { provider: "codex", reason: "codex-capability-available" };
  if (codexCapability?.status === "unknown") return { provider: "unavailable", reason: "codex-capability-unknown" };
  return { provider: "unavailable", reason: "no-provider-available" };
}
