import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  discoverReleaseRefs,
  extractGithubReleaseBody,
  validateReleaseNotes,
} from "../../tooling/validate-release-notes.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const releaseRef = Object.freeze({
  tag: "v1.2.3",
  commit: "0123456789abcdef0123456789abcdef01234567",
  date: "2026-08-20",
});
const releaseFilename = "2026-08-20-v1.2.3-테스트 릴리스.md";

function note({ tag = releaseRef.tag, commit = releaseRef.commit, date = releaseRef.date } = {}) {
  return `<!-- release-title: ${tag} — 테스트 릴리스 -->
<!-- release-date: ${date} -->
<!-- release-commit: ${commit} -->
<!-- release-status: published -->

# ${tag} — 테스트 릴리스

<!-- github-release:start -->

## GitHub 게시용 요약

사용자가 확인할 핵심 변경입니다.

### 주요 변경

사용자가 확인할 변경입니다.

### 업데이트 안내

추가 조치는 없습니다.

### 검증 요약

검증 결과를 기록합니다.

### 알려진 제한

알려진 제한을 기록합니다.

<!-- github-release:end -->

## 상세 릴리스 노트

### 변경 배경과 목표

변경의 이유와 목표를 기록합니다.

### 기능별 상세

구현된 동작과 사용자 영향을 기록합니다.

### 설치 및 업그레이드

설치와 전환 절차를 기록합니다.

### 호환성과 운영

지원 환경과 운영 주의사항을 기록합니다.

### 검증 근거

실행한 검증과 증거를 기록합니다.

### 변경 이력

- 전체 비교: https://github.com/example/project/compare/v1.2.2...${tag}
`;
}

test("GitHub release body extraction returns only the bounded summary", () => {
  const body = extractGithubReleaseBody(note());
  assert.match(body, /^## GitHub 게시용 요약/mu);
  assert.match(body, /### 주요 변경/u);
  assert.doesNotMatch(body, /## 상세 릴리스 노트/u);
  assert.doesNotMatch(body, /github-release:/u);
});

test("release note validation binds every release ref to its note and index", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "release-notes-"));
  try {
    await mkdir(path.join(root, "release"));
    await writeFile(path.join(root, "release", releaseFilename), note());
    await writeFile(path.join(root, "release", "README.md"), `- [v1.2.3](./${releaseFilename})\n`);

    const result = await validateReleaseNotes({ repoRoot: root, releaseRefs: [releaseRef] });
    assert.deepEqual(result.errors, []);
    assert.equal(result.notes.length, 1);
    assert.equal(result.notes[0].title, "v1.2.3 — 테스트 릴리스");
    assert.equal(result.notes[0].githubBody, extractGithubReleaseBody(note()));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release note validation rejects missing GitHub boundaries and detailed sections", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "release-notes-sections-"));
  try {
    await mkdir(path.join(root, "release"));
    const incomplete = note()
      .replace("<!-- github-release:start -->\n\n", "")
      .replace("\n### 호환성과 운영\n\n지원 환경과 운영 주의사항을 기록합니다.\n", "");
    await writeFile(path.join(root, "release", releaseFilename), incomplete);
    await writeFile(path.join(root, "release", "README.md"), `- [v1.2.3](./${releaseFilename})\n`);

    const result = await validateReleaseNotes({ repoRoot: root, releaseRefs: [releaseRef] });
    assert.ok(result.errors.some((message) => message.includes("github-release:start")));
    assert.ok(result.errors.some((message) => message.includes("호환성과 운영")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release note validation fails closed on missing notes, stale metadata, and an unindexed version", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "release-notes-invalid-"));
  try {
    await mkdir(path.join(root, "release"));
    await writeFile(path.join(root, "release", "README.md"), "# 릴리스 노트\n");
    let result = await validateReleaseNotes({ repoRoot: root, releaseRefs: [releaseRef] });
    assert.ok(result.errors.some((message) => message.includes("v1.2.3")));

    await writeFile(path.join(root, "release", releaseFilename), note({ date: "2026-08-19", commit: "f".repeat(40) }));
    result = await validateReleaseNotes({ repoRoot: root, releaseRefs: [releaseRef] });
    assert.ok(result.errors.some((message) => message.includes("release-date")));
    assert.ok(result.errors.some((message) => message.includes("release-commit")));
    assert.ok(result.errors.some((message) => message.includes("색인")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release note validation derives the natural filename summary from the release title", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "release-notes-filename-"));
  try {
    const wrongFilename = "2026-08-20-v1.2.3-틀린 제목.md";
    await mkdir(path.join(root, "release"));
    await writeFile(path.join(root, "release", wrongFilename), note());
    await writeFile(path.join(root, "release", "README.md"), `- [v1.2.3](./${wrongFilename})\n`);
    const result = await validateReleaseNotes({ repoRoot: root, releaseRefs: [releaseRef] });
    assert.ok(result.errors.some((message) => message.includes(releaseFilename)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the repository release history and enforcement surfaces stay complete", async () => {
  const releaseRefs = await discoverReleaseRefs({ repoRoot: repositoryRoot });
  assert.deepEqual(releaseRefs.map(({ tag }) => tag), ["v0.1.0", "v0.1.1", "v0.2.0"]);

  const result = await validateReleaseNotes({ repoRoot: repositoryRoot, releaseRefs });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.notes.map(({ path: notePath }) => notePath), [
    "release/2026-08-15-v0.1.0-게임 기획 스위트 초기 기준점.md",
    "release/2026-08-16-v0.1.1-게임 기획 플러그인 첫 공개 릴리스.md",
    "release/2026-08-20-v0.2.0-대표 진입 스킬, 제품 간 인계, 승인형 업그레이드.md",
  ]);

  const [packageJson, workflow, ciWorkflow, agents, readme] = await Promise.all([
    readFile(path.join(repositoryRoot, "package.json"), "utf8").then(JSON.parse),
    readFile(path.join(repositoryRoot, ".github", "workflows", "release-notes.yml"), "utf8"),
    readFile(path.join(repositoryRoot, ".github", "workflows", "ci.yml"), "utf8"),
    readFile(path.join(repositoryRoot, "AGENTS.md"), "utf8"),
    readFile(path.join(repositoryRoot, "README.md"), "utf8"),
  ]);
  assert.equal(packageJson.scripts["validate:release-notes"], "node tooling/validate-release-notes.mjs");
  assert.equal(packageJson.scripts["render:github-release-note"], "node tooling/validate-release-notes.mjs --github");
  assert.match(workflow, /release:\s*\n\s+types:\s*\[published, edited\]/u);
  assert.match(workflow, /tags:\s*\n\s+- "v\*"/u);
  assert.match(workflow, /fetch-depth:\s*0/u);
  assert.match(workflow, /npm run validate:release-notes/u);
  assert.match(
    ciWorkflow,
    /offline-gate:[\s\S]*?- uses: actions\/checkout@v4\s*\n\s*with:\s*\n(?:\s*#.*\n)*\s*fetch-depth:\s*0\s*\n\s*persist-credentials:\s*false/u,
  );
  assert.match(agents, /새 버전 태그를 만들기 전에 `release\/YYYY-MM-DD-vX\.Y\.Z-자연스러운 릴리스 요약\.md`/u);
  assert.match(agents, /\$humanize-korean/u);
  assert.match(readme, /\[버전별 릴리스 노트\]\(release\/README\.md\)/u);
});
