import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, lstat, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { afterEach } from "node:test";
import { fileURLToPath } from "node:url";

import { parseRestrictedYaml, validateArtifact } from "../../../shared/scripts/validate-artifact.mjs";
import { validateQualityProfile } from "../../../shared/scripts/validate-quality-profile.mjs";
import { buildProduct } from "../../../tooling/lib/build-product.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const templateRoot = path.join(repoRoot, "products/game-design-career/plugin/assets/templates");
const templateProfileMapPath = path.join(repoRoot, "products/game-design-career/plugin/references/document-quality/template-profile-map.json");
const rubricPath = path.join(repoRoot, "products/game-design-career/plugin/references/five-axis-rubric.json");
const temporaryDirs = [];

const templateIds = [
  "career-stage-goal",
  "game-design-role-map",
  "competency-matrix",
  "learning-roadmap",
  "job-posting-evidence",
  "portfolio-backlog",
  "portfolio-project-brief",
  "reverse-design-document",
  "creative-design-portfolio",
  "game-analysis-report",
  "five-axis-review",
  "interview-question-answer-log",
  "introduction-motivation",
  "junior-growth-review",
  "transition-readiness",
];

const expectedTemplateProfiles = {
  "career-stage-goal": "career-stage-role-map",
  "competency-matrix": "competency-matrix",
  "creative-design-portfolio": "portfolio-case-study",
  "five-axis-review": "portfolio-review-backlog",
  "game-analysis-report": "game-analysis-report",
  "game-design-role-map": "career-stage-role-map",
  "interview-question-answer-log": "interview-question-answer-report",
  "introduction-motivation": "recruiter-portfolio-presentation",
  "job-posting-evidence": "job-posting-evidence",
  "junior-growth-review": "junior-growth-review",
  "learning-roadmap": "learning-roadmap",
  "portfolio-backlog": "portfolio-review-backlog",
  "portfolio-project-brief": "portfolio-project-brief",
  "reverse-design-document": "reverse-design-document",
  "transition-readiness": "transition-readiness",
};

const requiredFiles = [
  "assets/README.md",
  "content.md",
  "decisions/README.md",
  "evidence.yml",
  "export-manifest.yml",
];

const typeContracts = {
  "career-stage-goal": ["stage", "target-role", "assumption", "owner", "approval", "change-history"],
  "game-design-role-map": ["role-family", "current-evidence", "target-level", "gap", "tradeoff", "proof-artifact"],
  "competency-matrix": ["requirement-id", "evidence-id", "not-observed", "minimum-repair", "re-evaluation"],
  "learning-roadmap": ["requirement-id", "learning-task", "owner", "cadence", "proof-artifact", "re-evaluation"],
  "job-posting-evidence": ["source-id", "posted-date", "retrieval-date", "region", "source-url", "source-type", "sample-geography", "freshness"],
  "portfolio-backlog": ["claim-id", "evidence-id", "attribution", "rights", "privacy", "inspectability", "minimum-repair"],
  "portfolio-project-brief": ["target-competency", "problem-user", "hypothesis-intent", "constraints-alternatives", "implementation-test", "result-decision", "retrospective", "rights"],
  "reverse-design-document": ["claim-id", "observation", "inference", "confidence", "counterexample", "alternative", "validation-method"],
  "creative-design-portfolio": ["claim-id", "evidence-id", "third-party-source", "attribution", "rights", "use-purpose", "privacy", "inspectability"],
  "game-analysis-report": ["observation", "inference", "source-address", "scope", "alternative", "validation-method"],
  "five-axis-review": ["section-id", "evidence-id", "not-observed", "no-defect", "defect-observed", "minimum-repair", "penalty"],
  "interview-question-answer-log": ["posting-evidence-id", "portfolio-evidence-id", "기본 질문", "꼬리 질문", "반론 질문", "상황 질문", "honest-answer", "do-not-fabricate"],
  "introduction-motivation": ["claim-id", "evidence-id", "target-role", "motivation", "honest-boundary", "privacy"],
  "junior-growth-review": ["requirement-id", "project-event-evidence", "owner", "cadence", "reviewer", "next-review-date", "proof-artifact"],
  "transition-readiness": ["current-evidence", "target-requirement", "posting-evidence-id", "retrieval-date", "region", "gap", "alternative", "verification-task"],
};

const recordFields = {
  "career-stage-goal": ["stage", "target-role", "goal", "success-evidence", "owner", "approval-status", "review-date"],
  "game-design-role-map": ["role-family", "current-evidence", "target-level", "gap", "learning-task", "feedback-cadence", "proof-artifact", "tradeoff"],
  "competency-matrix": ["requirement-id", "evidence-id", "observation-state", "target-level", "gap", "minimum-repair", "owner", "re-evaluation-date"],
  "learning-roadmap": ["requirement-id", "learning-task", "owner", "cadence", "proof-artifact", "reviewer", "re-evaluation-date"],
  "job-posting-evidence": ["source-id", "company", "project", "region", "employment-type", "posted-date", "source-url", "retrieval-date", "source-type", "sample-geography", "freshness"],
  "portfolio-backlog": ["backlog-id", "claim-id", "evidence-id", "target-competency", "attribution", "rights", "privacy", "inspectability", "minimum-repair", "owner"],
  "portfolio-project-brief": ["target-competency", "problem-user", "evidence", "hypothesis-intent", "rules-ui-data-content", "constraints-alternatives", "implementation-test", "result-decision", "retrospective", "rights"],
  "reverse-design-document": ["claim-id", "observation", "source-address", "scope", "inference", "confidence", "counterexample", "alternative", "validation-method"],
  "creative-design-portfolio": ["claim-id", "evidence-id", "target-competency", "third-party-source", "attribution", "rights", "use-purpose", "privacy", "inspectability"],
  "game-analysis-report": ["claim-id", "observation", "source-address", "source-type", "scope", "inference", "confidence", "counterexample", "alternative", "validation-method"],
  "five-axis-review": ["finding-id", "axis-id", "section-id", "evidence-id", "observation-state", "score", "penalty", "minimum-repair"],
  "interview-question-answer-log": ["question-id", "question-type", "posting-evidence-id", "portfolio-evidence-id", "answer-status", "honest-answer", "verification-task"],
  "introduction-motivation": ["claim-id", "evidence-id", "target-role", "motivation", "honest-boundary", "privacy", "approval-status"],
  "junior-growth-review": ["requirement-id", "project-event-evidence", "goal", "owner", "cadence", "reviewer", "next-review-date", "proof-artifact"],
  "transition-readiness": ["target-requirement", "current-evidence", "posting-evidence-id", "retrieval-date", "region", "gap", "alternative", "verification-task"],
};

const approvedContentHashes = {
  "career-stage-goal": "b561dd2134b5358d18266c71b09a0cd010647b53852cbefcb0b83a9b3045885b",
  "competency-matrix": "1654f4533eb7cccfddd2725c38bc39f8c0f8268be5e2f7c964ff785f85cb5f86",
  "creative-design-portfolio": "4b557714dff893071562ff92dad150c99908f7ce8b42cb0a0c87ecf006a3e083",
  "five-axis-review": "5446da50e85a09446326e8165295e969656866040a91960dde96d092be2e20e5",
  "game-analysis-report": "205fe0015ef17c45f1f99ca4f0ae7b277050163b659bd3c412c2e3b13a0273d2",
  "game-design-role-map": "ce1d1b6b60e088fc988fa6ce90dedf0410b6f6337bf431dd663b7ca8c2496ee1",
  "interview-question-answer-log": "3075c3f45953ac4fc6df5c0a069f16000fa5289551192e39f9b7c1990cb5278b",
  "introduction-motivation": "10f9d9a8063a5ebb93890f0ac323d5595be6cf4a1d044962f60639f1a04b8eed",
  "job-posting-evidence": "06a18d257861d74a60a97f8a5fbe8b11090ccc8bf1847c10c4fb8f34bf95f691",
  "junior-growth-review": "8f1ae546910b5fc1104c244b0dcbe2bb55a5dce9cc571c5124f40f5a8d889a1a",
  "learning-roadmap": "b5d4cf5fad12d9eac2fbd01441ed4fc7a2627c9176b7ceae66978dacb32ba4d6",
  "portfolio-backlog": "0f515970462832b3d439861f9db72603503cd3f6b57b5ed42a521d26ca40991b",
  "portfolio-project-brief": "856f6c9ab5bd0946c4ff10ee74d15fae235da2154c9e74f87388af5f00ea0d69",
  "reverse-design-document": "bd3f786f95fd75bbfe78d64cad663fcb5c4d6543555ebd6edbe38a0c7ba0e5ac",
  "transition-readiness": "7834ee78642beb8b49990ba4e5fbad5f2c00d9c0692cac73c42f509a625501a4",
};

const semanticContracts = {
  "career-stage-goal": [
    ["stage-and-target-role", "`stage`: 경력 단계를 기록합니다. 값은 `entry`, `new-hire`, `junior-growth`, `transition` 중 하나를 사용합니다. `target-role`: 근거가 있을 때만 직무군과 레벨을 적습니다."],
    ["goal-contract", "달성할 결과, 성공 근거, 기한, 담당자, 검토일을 분명히 정합니다. 정답인 경력 경로가 확정되지 않았다면 여러 경로를 함께 남깁니다."],
  ],
  "game-design-role-map": [
    ["role-families-and-tradeoffs", "각 직무군(`role-family`)에 목표 레벨, 현재 근거(`current-evidence`), 역량 차이, 선택 기준, 학습 과제, 피드백 주기, 증빙 산출물(`proof-artifact`)을 기록합니다."],
    ["provisional-paths", "목표가 불분명하면 가능성 있는 경로를 적어도 두 개 남깁니다. 나이, 학력, 전공, 공백 기간으로 순위를 매기지 않습니다."],
  ],
  "competency-matrix": [
    ["requirement-matrix", "각 requirement-id에 안정적인 evidence-id, 관찰 상태, 범위, 검토자를 연결합니다. 근거가 없을 때는 not-observed를 사용합니다."],
    ["repair-and-re-evaluation", "근거가 없다고 역량 점수를 0점으로 처리하지 않습니다. minimum-repair, 담당자, 증빙 산출물, 재평가일을 기록합니다."],
  ],
  "learning-roadmap": [
    ["roadmap-commitments", "각 요구 사항 ID(`requirement-id`)에 학습 과제(`learning-task`), 담당자, 주기, 증빙 산출물(`proof-artifact`), 검토자, 재평가 결정을 기록합니다."],
    ["sequence-and-dependencies", "투입 가능 시간을 뒷받침할 근거가 생기기 전까지 기간은 가설로 표시합니다. 선행 조건, 피드백 시점, 범위 선택을 분명히 남깁니다."],
  ],
  "job-posting-evidence": [
    ["posting-records", "각 기록에는 출처 ID(`source-id`), 회사, 명시된 경우 프로젝트, 지역, 고용 형태, 게시일(`posted-date`), 출처 URL(`source-url`), 조회일(`retrieval-date`), 출처 유형(`source-type`), 담당 업무, 필수 역량, 우대 역량을 기록합니다."],
    ["freshness-and-sample-limits", "최신성 분류, 표본 수, sample-geography, 사각지대, 일반화할 수 없는 요구 사항을 기록합니다. 반복되는 신호는 여러 source ID로 확인합니다."],
  ],
  "portfolio-backlog": [
    ["backlog-records", "각 항목에 claim-id, evidence-id, 목표 역량, 출처 이력, 개인 또는 팀 기여 표기, 권리, 개인정보, 완성도, 상태, 검토 가능성을 연결합니다."],
    ["minimum-repairs", "근거가 부족한 항목은 공개 전에 minimum-repair, 보완 담당자, 실행 작업, 증빙 산출물, 검토 기준을 기록합니다."],
  ],
  "portfolio-project-brief": [
    ["decision-chain", "아래 의사결정 항목의 순서를 그대로 사용합니다: `target-competency` → `problem-user` → `evidence` → `hypothesis-intent` → `rules/UI/data/content` → `constraints-alternatives` → `implementation-test` → `result-decision` → `retrospective`."],
    ["publication-boundary", "개인·팀 기여 표기, 제3자 출처, 이용 목적, 권리, 개인정보, 구현 상태, 근거의 한계를 기록합니다."],
  ],
  "reverse-design-document": [
    ["claim-records", "각 주장 ID(`claim-id`)에 관찰 내용, 출처 위치(`source address`), 범위, 추론, 신뢰도, 반례, 대안, 검증 방법(`validation-method`)을 독립적으로 기록합니다."],
    ["fact-and-inference-boundary", "관찰 내용이 없으면 inference는 null로 두고 confidence를 평가하지 않습니다. 내부 의도나 구현 내용을 사실처럼 제시하지 않습니다."],
  ],
  "creative-design-portfolio": [
    ["portfolio-story", "주요 claim-id마다 목표 역량, 문제, 결정 근거, 대안, 구현 범위, 결과, 회고를 evidence-id에 연결합니다."],
    ["third-party-and-publication-rights", "공개 전에 third-party-source, 출처 표기, 권리, 이용 목적, 개인정보, 인용 범위, 개인·팀 기여 범위, 검토 가능성을 기록합니다."],
  ],
  "game-analysis-report": [
    ["analysis-claims", "각 안정적인 주장에는 관찰 내용, source-address, 출처 유형, 범위, 추론, 신뢰도, 반례, 대안, validation-method를 기록합니다."],
    ["decision-use", "기획자가 참고할 수 있는 내용, 아직 알 수 없는 내용, 분석을 바꿀 근거를 적습니다. 문서화되지 않은 내부 의도는 사실처럼 재구성하지 않습니다."],
  ],
  "five-axis-review": [
    ["review-records", "모든 기록에 발견 ID(`finding-id`), 축 ID(`axis-id`), 안정적인 섹션 ID(`section-id`)와 근거 ID(`evidence-id`), 관찰 상태, 점수 또는 미채점(`not-scored`), 영향도, 최소 보완 작업(`minimum-repair`)을 남깁니다."],
    ["observation-and-penalty-rules", "관찰 불가(`not-observed`), 결함 없음(`no-defect`), 결함 관찰됨(`defect-observed`)을 구분합니다. 모순, 근거 없는 단정, 중복, 범위, 출처는 각각 따로 감점합니다."],
  ],
  "interview-question-answer-log": [
    ["question-set", "기본 질문, 꼬리 질문, 반론 질문, 상황 질문마다 채용 공고 근거 ID(`posting-evidence-id`), 포트폴리오 근거 ID(`portfolio-evidence-id`) 또는 명시된 직무 공통 출처를 연결합니다."],
    ["honest-answer-boundary", "주장, 근거, 선택, 대안, 결과, 회고를 연결합니다. 팀 규모, 매출, 리텐션, 소유권, 구현 결과는 do-not-fabricate 원칙을 지킵니다. 뒷받침할 근거가 없으면 honest-answer와 검증 작업을 기록합니다."],
  ],
  "introduction-motivation": [
    ["claim-map", "모든 claim-id에 목표 직무의 요구 사항, evidence-id, 개인·팀 기여 범위, 출처의 한계를 연결합니다. 지원 동기와 검증된 경험은 구분합니다."],
    ["honest-and-private-boundary", "근거가 없을 때는 honest-boundary를 사용합니다. 불필요한 개인정보를 삭제하고, 공유 전 개인정보와 공개 승인을 기록합니다."],
  ],
  "junior-growth-review": [
    ["quarterly-evidence", "각 요구 사항 ID(`requirement-id`)에 프로젝트 이벤트 근거(`project-event-evidence`), 개인·팀 기여 표기, 결정, 결과 상태, 한계, 증빙 산출물(`proof-artifact`)을 연결합니다."],
    ["growth-commitments", "각 목표에는 담당자, 주기, 검토자, 입력 산출물, next-review-date, 목표 깊이 또는 폭, 재평가 규칙을 기록합니다."],
  ],
  "transition-readiness": [
    ["readiness-matrix", "각 목표 요구 사항(`target-requirement`)에 현재 근거(`current-evidence`)와 채용 공고 근거 ID(`posting-evidence-id`)를 연결합니다. 출처 URL, 조회일(`retrieval-date`), 지역, 출처 유형, 역량 차이, 범위, 최신성을 기록합니다."],
    ["decision-options", "대안 경로, 선택 기준, 최소 근거, 담당자, verification-task, 검토일, 채용을 보장하지 않는 범위를 분명히 기록합니다."],
  ],
};

const commonSemanticClauses = [
  "전제는 승인된 사실이 아닙니다.",
  "자동화 도구는 승인이나 권한을 부여할 수 없습니다.",
  "최신 주장은 날짜가 있는 1차 출처, 조회일, 지역 또는 적용 범위, 재검토일, 갱신 담당자를 갖춰야 합니다.",
  "제3자 자료에는 출처, 출처 표기, 이용 목적, 권리 또는 인용 유의사항, 개인정보 처리 방침도 기록합니다.",
  "Markdown을 제목 단위로 기계적으로 나누지 마세요.",
];

function semanticSection(content, id) {
  const marker = new RegExp("^## [^\\r\\n]* \\{#" + id + "\\}\\r?\\n", "mu");
  const match = marker.exec(content);
  assert.ok(match, "missing semantic section " + id);
  const bodyStart = match.index + match[0].length;
  const next = content.indexOf("\n## ", bodyStart);
  return content.slice(bodyStart, next === -1 ? content.length : next).trim();
}

function assertStableSection(content, id) {
  assert.match(content, new RegExp("^## [^\\r\\n]* \\{#" + id + "\\}$", "mu"), "missing stable section " + id);
}

test("semantic sections use stable anchors instead of localized visible titles", () => {
  const content = "## 기획 항목: Localized title {#stable-section}\n\nRequired semantic meaning.\n\n## 다음 섹션 {#next-section}\n\nOther meaning.\n";
  assert.equal(semanticSection(content, "stable-section"), "Required semantic meaning.");
});

function assertSemanticContract(templateId, content) {
  assert.deepEqual(Object.keys(semanticContracts).sort(), [...templateIds].sort());
  for (const [id, requiredMeaning] of semanticContracts[templateId]) {
    assert.equal(semanticSection(content, id), requiredMeaning, `${templateId}: semantic contract ${id}`);
  }
  for (const clause of commonSemanticClauses) {
    assert.ok(content.includes(clause), `${templateId}: missing semantic clause ${clause}`);
  }
}

function parseContentFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/u);
  assert.ok(match, "content must start with frontmatter");
  return parseRestrictedYaml(match[1], "content.md frontmatter");
}

afterEach(async () => {
  await Promise.all(temporaryDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function filesBelow(root) {
  const result = [];
  async function walk(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative);
      else if (entry.isFile()) result.push(relative);
    }
  }
  await walk(root);
  return result.sort();
}

async function temporaryTemplate(templateId) {
  const target = await mkdtemp(path.join(os.tmpdir(), `career-template-${templateId}-`));
  temporaryDirs.push(target);
  await cp(path.join(templateRoot, templateId), target, { recursive: true });
  return target;
}

async function replaceIn(root, relativePath, before, after) {
  const file = path.join(root, relativePath);
  const source = await readFile(file, "utf8");
  assert.ok(source.includes(before), `${relativePath} must contain ${JSON.stringify(before)}`);
  await writeFile(file, source.replace(before, after), "utf8");
}

function errorMessages(result) {
  return result.errors.map(({ message }) => message).join("\n");
}

function assertUsableTemplate(templateId, content, evidence, manifest, expectedContentHash) {
  assert.match(expectedContentHash, /^[a-f0-9]{64}$/u, `${templateId}: approved content hash`);
  assert.equal(
    createHash("sha256").update(content, "utf8").digest("hex"),
    expectedContentHash,
    `${templateId}: approved release seed bytes`,
  );
  const metadata = parseContentFrontmatter(content);
  assert.equal(metadata.artifact_id, templateId, `${templateId}: frontmatter identity`);
  assert.match(content, /^# .+ \{#[a-z0-9-]+\}$/mu);
  assertStableSection(content, "assumptions-and-boundaries");
  assertStableSection(content, "owners-and-approvals");
  assertStableSection(content, "change-history");
  assertStableSection(content, "evidence-and-freshness");
  assert.doesNotMatch(content, /\b(?:TODO|TBD|lorem ipsum|fill this|placeholder)\b/iu);
  for (const token of typeContracts[templateId]) {
    assert.match(content, new RegExp(token, "iu"), `${templateId}: missing ${token}`);
  }
  const actualRecordFields = content
    .split("\n")
    .filter((line) => /^\| `[^`]+` \|/u.test(line))
    .map((line) => line.split("|")[1].trim().replaceAll("`", ""));
  assert.deepEqual(actualRecordFields, recordFields[templateId], `${templateId}: exact working-record fields`);
  assertSemanticContract(templateId, content);
  assert.equal(evidence.version, 1);
  assert.ok(Array.isArray(evidence.claims) && evidence.claims.length > 0);
  for (const claim of evidence.claims) {
    assert.match(claim.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
    assert.ok(claim.source.locator || claim.source.url);
    assert.match(claim.source.accessed_at, /^\d{4}-\d{2}-\d{2}$/u);
    assert.ok(["low", "medium", "high"].includes(claim.confidence));
    assert.ok(claim.limitations.trim());
  }
  assert.equal(evidence.claims[0].id, `claim-${templateId}`, `${templateId}: evidence identity`);
  assert.equal(evidence.claims[0].source.locator, "content.md", `${templateId}: evidence source identity`);
  assert.equal(manifest.artifact_id, templateId);
  assert.equal(metadata.artifact_id, manifest.artifact_id, `${templateId}: content/manifest identity`);
  assert.deepEqual(Object.keys(manifest.formats).sort(), ["docx", "md", "pdf", "pptx"]);
  assert.ok(manifest.formats.pptx.audience.trim());
  assert.ok(manifest.formats.pptx.purpose.trim());
  assert.ok(manifest.formats.pptx.slide_outline.length >= 3);
  assert.equal(new Set(manifest.formats.pptx.slide_outline.map(({ title }) => title)).size, manifest.formats.pptx.slide_outline.length);
}

test("exactly the 15 approved Career templates ship with complete canonical seed files", async () => {
  assert.deepEqual((await readdir(templateRoot)).sort(), [...templateIds].sort());
  for (const templateId of templateIds) {
    const root = path.join(templateRoot, templateId);
    assert.deepEqual(await filesBelow(root), requiredFiles);
    for (const relativePath of requiredFiles) {
      assert.equal((await lstat(path.join(root, relativePath))).isFile(), true);
      assert.ok((await readFile(path.join(root, relativePath), "utf8")).trim(), `${templateId}/${relativePath} is empty`);
    }
    const decisions = await readFile(path.join(root, "decisions/README.md"), "utf8");
    for (const field of ["decision ID", "date", "owner", "status", "alternatives", "evidence IDs", "rationale", "approver", "reopen condition"]) {
      assert.match(decisions, new RegExp(field, "iu"), `${templateId}: decision register missing ${field}`);
    }
    const assets = await readFile(path.join(root, "assets/README.md"), "utf8");
    for (const field of ["relative local assets", "source", "creator", "attribution", "use purpose", "rights or consent", "privacy", "approver", "approval date", "alt text"]) {
      assert.match(assets, new RegExp(field, "iu"), `${templateId}: asset register missing ${field}`);
    }
  }
});

test("all 15 Career templates resolve to exactly one declared primary quality profile", async () => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "career-template-profile-build-"));
  temporaryDirs.push(stagingRoot);
  const build = await buildProduct({ repoRoot, productName: "game-design-career", stagingRoot, sourceDateEpoch: 0 });
  const packagedTemplateRoot = path.join(build.outputDir, "assets/templates");
  const packagedCatalogRoot = path.join(build.outputDir, "references/shared/document-quality/profiles/career");
  const mappingSource = await readFile(templateProfileMapPath, "utf8").catch(() => null);
  assert.notEqual(mappingSource, null, "Career template profile mapping must exist");
  const packagedMappingSource = await readFile(path.join(build.outputDir, "references/document-quality/template-profile-map.json"), "utf8");
  assert.equal(packagedMappingSource, mappingSource, "clean build must preserve the mapping bytes");
  const mapping = JSON.parse(packagedMappingSource);
  assert.deepEqual(Object.keys(mapping).sort(), ["product", "schema_version", "templates"]);
  assert.equal(mapping.schema_version, 1);
  assert.equal(mapping.product, "game-design-career");
  assert.deepEqual(mapping.templates, expectedTemplateProfiles);
  assert.deepEqual(Object.keys(mapping.templates).sort(), (await readdir(packagedTemplateRoot)).sort());

  for (const [templateId, profileId] of Object.entries(mapping.templates)) {
    assert.equal(typeof profileId, "string", `${templateId}: primary profile must be one string`);
    const profile = JSON.parse(await readFile(path.join(packagedCatalogRoot, `${profileId}.json`), "utf8"));
    const profileValidation = validateQualityProfile(profile, { sourceName: `${profileId}.json` });
    assert.equal(profileValidation.ok, true, `${profileId}: ${JSON.stringify(profileValidation.errors)}`);
    assert.equal(profile.profile_id, profileId, `${templateId}: catalog resolution`);

    const content = await readFile(path.join(packagedTemplateRoot, templateId, "content.md"), "utf8");
    assert.equal(parseContentFrontmatter(content).quality_profile, profileId, `${templateId}: frontmatter mapping`);
    const result = await validateArtifact(path.join(packagedTemplateRoot, templateId), {
      requireQualityProfile: true,
      profileCatalogRoot: packagedCatalogRoot,
    });
    assert.equal(result.ok, true, `${templateId}: ${errorMessages(result)}`);
  }
});

test("approved content hash map exactly covers all source seeds and clean-built copies", async () => {
  assert.deepEqual(Object.keys(approvedContentHashes).sort(), [...templateIds].sort());
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "career-template-build-"));
  temporaryDirs.push(stagingRoot);
  const build = await buildProduct({
    repoRoot,
    productName: "game-design-career",
    stagingRoot,
    sourceDateEpoch: 0,
  });
  for (const templateId of templateIds) {
    const relativePath = path.join("assets", "templates", templateId, "content.md");
    const sourceBytes = await readFile(path.join(templateRoot, templateId, "content.md"));
    const builtBytes = await readFile(path.join(build.outputDir, relativePath));
    assert.deepEqual(builtBytes, sourceBytes, `${templateId}: clean-built bytes`);
    assert.equal(
      createHash("sha256").update(sourceBytes).digest("hex"),
      approvedContentHashes[templateId],
      `${templateId}: source seed hash`,
    );
  }
});

test("every template instantiates as a real Canonical Artifact through the production validator", async () => {
  for (const templateId of templateIds) {
    const fixture = await temporaryTemplate(templateId);
    const result = await validateArtifact(fixture, { requestedFormats: ["md", "pdf", "docx", "pptx"] });
    assert.equal(result.ok, true, `${templateId}: ${errorMessages(result)}`);
    assertUsableTemplate(
      templateId,
      await readFile(path.join(fixture, "content.md"), "utf8"),
      parseRestrictedYaml(await readFile(path.join(fixture, "evidence.yml"), "utf8")),
      parseRestrictedYaml(await readFile(path.join(fixture, "export-manifest.yml"), "utf8")),
      approvedContentHashes[templateId],
    );
  }
});

test("type-specific completion gates reject diluted or generic seeds", async () => {
  for (const templateId of templateIds) {
    const content = await readFile(path.join(templateRoot, templateId, "content.md"), "utf8");
    const evidence = parseRestrictedYaml(await readFile(path.join(templateRoot, templateId, "evidence.yml"), "utf8"));
    const manifest = parseRestrictedYaml(await readFile(path.join(templateRoot, templateId, "export-manifest.yml"), "utf8"));
    const token = typeContracts[templateId][0];
    assert.throws(
      () => assertUsableTemplate(templateId, content.replace(new RegExp(token, "giu"), "generic-field"), evidence, manifest, approvedContentHashes[templateId]),
      undefined,
      `${templateId}: type-specific mutation survived`,
    );
  }
});

test("semantic mutation guard rejects reversed safety and evidence meanings", async () => {
  async function assertMutationRejected(templateId, mutate) {
    const root = path.join(templateRoot, templateId);
    const content = await readFile(path.join(root, "content.md"), "utf8");
    const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
    const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
    const mutated = mutate(content);
    assert.notEqual(mutated, content, `${templateId}: mutation must alter the fixture`);
    assert.throws(() => assertUsableTemplate(templateId, mutated, evidence, manifest, approvedContentHashes[templateId]));
  }

  await assertMutationRejected("reverse-design-document", (content) => content.replace(
    "관찰 내용이 없으면 inference는 null로 두고 confidence를 평가하지 않습니다. 내부 의도나 구현 내용을 사실처럼 제시하지 않습니다.",
    "관찰 내용이 없어도 inference를 추정하고 confidence를 높게 평가합니다. 내부 의도나 구현 내용을 사실처럼 제시해도 됩니다.",
  ));
  await assertMutationRejected("interview-question-answer-log", (content) => content.replace(
    "팀 규모, 매출, 리텐션, 소유권, 구현 결과는 do-not-fabricate 원칙을 지킵니다. 뒷받침할 근거가 없으면 honest-answer와 검증 작업을 기록합니다.",
    "팀 규모, 매출, 리텐션, 소유권, 구현 결과는 추정해도 됩니다. 뒷받침할 근거가 없으면 검증 작업 대신 추정한 답변을 기록합니다.",
  ));
  await assertMutationRejected("creative-design-portfolio", (content) => content.replace(
    "공개 전에 third-party-source, 출처 표기, 권리, 이용 목적, 개인정보, 인용 범위, 개인·팀 기여 범위, 검토 가능성을 기록합니다.",
    "공개 전에 third-party-source, 출처 표기, 권리, 이용 목적, 개인정보, 인용 범위, 개인·팀 기여 범위, 검토 가능성을 승인된 것으로 간주합니다.",
  ));
  await assertMutationRejected("job-posting-evidence", (content) => content.replace(
    "최신 주장은 날짜가 있는 1차 출처, 조회일, 지역 또는 적용 범위, 재검토일, 갱신 담당자를 갖춰야 합니다.",
    "최신 주장은 날짜가 있는 1차 출처, 조회일, 지역 또는 적용 범위, 재검토일, 갱신 담당자를 생략해도 됩니다.",
  ));
});

test("semantic consistency rejects contradictory permission added outside the required section", async () => {
  async function assertAddedContradictionRejected(templateId, contradiction) {
    const root = path.join(templateRoot, templateId);
    const content = await readFile(path.join(root, "content.md"), "utf8");
    const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
    const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
    const mutated = `${content}\n## Exception Policy {#exception-policy}\n\n${contradiction}\n`;
    assert.throws(() => assertUsableTemplate(templateId, mutated, evidence, manifest, approvedContentHashes[templateId]));
  }

  await assertAddedContradictionRejected(
    "reverse-design-document",
    "신뢰도가 높으면 내부 의도와 구현 내용을 사실처럼 제시해도 됩니다.",
  );
  await assertAddedContradictionRejected(
    "interview-question-answer-log",
    "답변이 불완전하면 팀 규모, 매출, 리텐션, 소유권, 구현 결과를 추정해 만들어도 됩니다.",
  );
  await assertAddedContradictionRejected(
    "creative-design-portfolio",
    "공개 전 제3자 권리와 개인정보는 승인된 것으로 간주해도 됩니다.",
  );
  await assertAddedContradictionRejected(
    "job-posting-evidence",
    "최신 채용 주장은 오래된 근거를 사용하고 1차 출처, 조회일, 지역, 갱신 담당자를 생략해도 됩니다.",
  );
});

test("semantic guard rejects split-prose and synonymous contradictory additions", async () => {
  async function assertAdditionRejected(templateId, addition) {
    const root = path.join(templateRoot, templateId);
    const content = await readFile(path.join(root, "content.md"), "utf8");
    const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
    const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
    assert.throws(() => assertUsableTemplate(templateId, `${content}\n${addition}\n`, evidence, manifest, approvedContentHashes[templateId]));
  }

  await assertAdditionRejected(
    "reverse-design-document",
    "## 분할 예외 {#split-exception}\n\n내부 의도와 구현 내용을 제시해도 됩니다.\n\n신뢰도가 높으면 사실처럼 제시합니다.",
  );
  await assertAdditionRejected(
    "creative-design-portfolio",
    "## 권리 예외 {#clearance-exception}\n\n라이선스와 기밀성은 승인된 것으로 간주해도 됩니다.",
  );
});

test("frontmatter identity cannot be spoofed by an expected artifact_id string in the body", async () => {
  const templateId = "career-stage-goal";
  const root = path.join(templateRoot, templateId);
  const content = await readFile(path.join(root, "content.md"), "utf8");
  const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
  const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
  const spoofed = content
    .replace("artifact_id: career-stage-goal", "artifact_id: game-design-role-map")
    .concat("\nExpected identity note: artifact_id: career-stage-goal\n");
  assert.throws(() => assertUsableTemplate(templateId, spoofed, evidence, manifest, approvedContentHashes[templateId]));
});

test("generic token-only prose cannot satisfy a type-specific semantic contract", async () => {
  const templateId = "reverse-design-document";
  const root = path.join(templateRoot, templateId);
  const content = await readFile(path.join(root, "content.md"), "utf8");
  const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
  const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
  const generic = content
    .replace(
      "각 주장 ID(`claim-id`)에 관찰 내용, 출처 위치(`source address`), 범위, 추론, 신뢰도, 반례, 대안, 검증 방법(`validation-method`)을 독립적으로 기록합니다.",
      "claim-id observation source address scope inference confidence counterexample alternative validation-method.",
    )
    .replace(
      "관찰 내용이 없으면 inference는 null로 두고 confidence를 평가하지 않습니다. 내부 의도나 구현 내용을 사실처럼 제시하지 않습니다.",
      "observation inference confidence fact.",
    );
  assert.throws(() => assertUsableTemplate(templateId, generic, evidence, manifest, approvedContentHashes[templateId]));
});

test("five-axis rubric has exact axes, evidence-only levels, separate penalties, and minimum repairs", async () => {
  const rubric = JSON.parse(await readFile(rubricPath, "utf8"));
  assert.deepEqual(Object.keys(rubric).sort(), ["axes", "observationStates", "penalties", "schemaVersion"]);
  assert.equal(rubric.schemaVersion, 1);
  assert.deepEqual(rubric.axes.map(({ id }) => id), [
    "intent-problem",
    "player-experience-fun",
    "implementation-data-validation",
    "readability-navigation",
    "differentiation-decision-rationale-reflection",
  ]);
  for (const axis of rubric.axes) {
    assert.deepEqual(Object.keys(axis).sort(), ["id", "levels", "name"]);
    assert.deepEqual(axis.levels.map(({ score }) => score), [0, 1, 2, 3, 4]);
    for (const level of axis.levels) {
      assert.deepEqual(Object.keys(level).sort(), ["observableEvidence", "score"]);
      assert.ok(level.observableEvidence.trim());
      assert.doesNotMatch(level.observableEvidence, /talent|ability|potential|seems|likely/iu);
    }
  }
  assert.deepEqual(rubric.penalties.map(({ id }) => id), [
    "contradiction",
    "unsupported-certainty",
    "duplication",
    "scope",
    "source",
  ]);
  for (const penalty of rubric.penalties) {
    assert.deepEqual(Object.keys(penalty).sort(), ["id", "minimumRepair", "observableTrigger"]);
    assert.ok(penalty.observableTrigger.trim());
    assert.ok(penalty.minimumRepair.trim());
  }
  assert.deepEqual(rubric.observationStates, {
    "not-observed": "Condition was not inspectable; this is not no-defect and not an ability score of zero.",
    "no-defect": "The cited sections and evidence were inspected and no defect of the named type was found.",
    "defect-observed": "The cited sections and evidence directly support the named defect.",
  });
});

test("rubric contract rejects renamed axes, ability proxies, merged penalties, and unknown keys", async () => {
  const rubric = JSON.parse(await readFile(rubricPath, "utf8"));
  const validate = (candidate) => {
    assert.deepEqual(Object.keys(candidate).sort(), ["axes", "observationStates", "penalties", "schemaVersion"]);
    assert.deepEqual(candidate.axes.map(({ id }) => id), [
      "intent-problem",
      "player-experience-fun",
      "implementation-data-validation",
      "readability-navigation",
      "differentiation-decision-rationale-reflection",
    ]);
    assert.deepEqual(candidate.penalties.map(({ id }) => id), [
      "contradiction",
      "unsupported-certainty",
      "duplication",
      "scope",
      "source",
    ]);
    for (const axis of candidate.axes) {
      assert.deepEqual(axis.levels.map(({ score }) => score), [0, 1, 2, 3, 4]);
      for (const level of axis.levels) assert.doesNotMatch(level.observableEvidence, /talent|ability|potential|seems|likely/iu);
    }
  };
  validate(rubric);
  for (const mutation of [
    { ...rubric, extra: true },
    { ...rubric, axes: rubric.axes.map((axis, index) => index === 0 ? { ...axis, id: "career-fit" } : axis) },
    { ...rubric, axes: rubric.axes.map((axis, index) => index === 0 ? { ...axis, levels: axis.levels.map((level, levelIndex) => levelIndex === 0 ? { ...level, observableEvidence: "No talent was observed." } : level) } : axis) },
    { ...rubric, penalties: rubric.penalties.filter(({ id }) => id !== "source") },
    { ...rubric, penalties: rubric.penalties.map((penalty, index) => index === 0 ? { ...penalty, id: "contradiction-or-source" } : penalty) },
  ]) assert.throws(() => validate(mutation));
});

test("all Markdown links in template seeds resolve inside their artifact", async () => {
  for (const templateId of templateIds) {
    const root = path.join(templateRoot, templateId);
    for (const relativePath of requiredFiles.filter((name) => name.endsWith(".md"))) {
      const markdown = await readFile(path.join(root, relativePath), "utf8");
      for (const match of markdown.matchAll(/(?<!!)\[[^\]]+\]\(([^)\s]+)\)/gu)) {
        const destination = decodeURIComponent(match[1].split("#", 1)[0]);
        if (!destination) continue;
        assert.doesNotMatch(destination, /^(?:[a-z]+:|\/|\.\.\/)/iu, `${templateId}/${relativePath}: unsafe link`);
        const resolved = path.resolve(path.dirname(path.join(root, relativePath)), destination);
        assert.ok(resolved.startsWith(`${root}${path.sep}`), `${templateId}/${relativePath}: link escapes artifact`);
        assert.equal((await lstat(resolved)).isFile(), true, `${templateId}/${relativePath}: missing ${destination}`);
      }
    }
  }
});

test("production validation rejects dangerous YAML, traversal, missing assets, and symlink assets", async () => {
  const unsafeYaml = await temporaryTemplate("career-stage-goal");
  await replaceIn(unsafeYaml, "evidence.yml", "version: 1", "__proto__: poisoned\nversion: 1");
  let result = await validateArtifact(unsafeYaml);
  assert.equal(result.ok, false);
  assert.match(errorMessages(result), /unsafe mapping key/i);

  for (const unsafePath of ["../outside.svg", "assets/../../outside.svg", "/tmp/outside.svg"]) {
    const traversal = await temporaryTemplate("game-design-role-map");
    await replaceIn(
      traversal,
      "content.md",
      "근거가 확보된 뒤 첫 번째 다이어그램을 추가할 수 있습니다.",
      `![Role map](${unsafePath})`,
    );
    result = await validateArtifact(traversal);
    assert.equal(result.ok, false, unsafePath);
    assert.match(errorMessages(result), /relative local asset|inside assets/i);
  }

  const missingAsset = await temporaryTemplate("competency-matrix");
  await replaceIn(
    missingAsset,
    "content.md",
    "근거가 확보된 뒤 첫 번째 다이어그램을 추가할 수 있습니다.",
    "![Competency map](assets/missing.svg)",
  );
  result = await validateArtifact(missingAsset);
  assert.equal(result.ok, false);
  assert.match(errorMessages(result), /does not exist/i);

  const linkedAsset = await temporaryTemplate("learning-roadmap");
  const external = path.join(linkedAsset, "..", "outside.svg");
  await writeFile(external, '<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf8");
  await symlink(external, path.join(linkedAsset, "assets/linked.svg"));
  await replaceIn(
    linkedAsset,
    "content.md",
    "근거가 확보된 뒤 첫 번째 다이어그램을 추가할 수 있습니다.",
    "![Learning roadmap](assets/linked.svg)",
  );
  result = await validateArtifact(linkedAsset);
  assert.equal(result.ok, false);
  assert.match(errorMessages(result), /does not exist/i);
});
