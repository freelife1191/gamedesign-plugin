import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { generateOpenAIImages } from "../shared/scripts/generate-openai-images.mjs";
import { loadImageConfig } from "../shared/scripts/validate-image-config.mjs";

async function main() {
  const config = await loadImageConfig({ workspaceRoot: process.cwd() });
  if (!config.apiKeyPresent) {
    console.log("SKIPPED: OPENAI_API_KEY is not set; no image generation performed.");
    return;
  }
  const stagingRoot = await mkdtemp(path.join(tmpdir(), "game-design-openai-image-smoke-"));
  try {
    const result = await generateOpenAIImages({
      jobs: [{
        asset_id: "live-smoke-image",
        prompt: "A simple original geometric compass icon on an opaque neutral background, with no text or logos.",
        output: { path: "assets/generated/live-smoke-image.png", width: 1024, height: 1024, format: "png" },
      }],
      apiKey: config.apiKey,
      model: "gpt-image-2",
      quality: "low",
      stagingRoot,
    });
    console.log(JSON.stringify({ smoke: "openai-image", provider: result.provider, results: result.results, failures: result.failures }));
    if (result.failures.length > 0) process.exitCode = 1;
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

main().catch(() => {
  console.error("OpenAI image smoke failed without exposing request details.");
  process.exitCode = 1;
});
