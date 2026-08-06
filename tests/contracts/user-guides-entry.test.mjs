import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

for (const product of ["game-design-studio", "game-design-career"]) {
  test(product + " entry guide separates App and CLI workflows", async () => {
    const base = path.join(root, "guides", product);
    const installation = await readFile(path.join(base, "installation.md"), "utf8");
    const quickStart = await readFile(path.join(base, "quick-start.md"), "utf8");
    for (const heading of ["Codex App 설치", "Codex CLI 설치", "설치 확인", "업데이트", "제거"]) {
      assert.match(installation, new RegExp("^## " + heading + "$", "m"));
    }
    assert.match(installation, /새 채팅/);
    assert.match(installation, /새 세션/);
    assert.match(installation, /Git marketplace/);
    assert.doesNotMatch(installation, /plugin 자동 업데이트/);
    assert.match(quickStart, /복사 가능한 요청문/);
    assert.match(quickStart, /예상 결과/);
  });
}
