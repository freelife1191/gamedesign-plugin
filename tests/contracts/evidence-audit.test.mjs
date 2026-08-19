import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

function validFixture() {
  const url = "https://example.gov/primary";
  const claim = {
    id: "CUR-FIXTURE-001",
    type: "time-sensitive",
    basis: "current-external-claim",
    guidance: "현재 공식 근거를 확인한다.",
    sourceIds: ["local-source-001", "EXT-FIXTURE-001"],
    applicability: "감사기 계약 fixture에 적용한다.",
    counterexamples: ["근거가 없는 경우에는 적용하지 않는다."],
    verifiedAt: "2026-08-04",
    reviewAfter: "2027-02-04",
    primaryUrls: [url],
    regionScope: "fixture 범위",
    limitations: "실제 정책 근거가 아닌 테스트 fixture다.",
  };
  return {
    documents: [["fixture.md", `# Fixture\n\n\`\`\`claim\n${JSON.stringify(claim)}\n\`\`\``]],
    index: { documents: [{ id: "local-source-001" }] },
    register: {
      retrievedAt: "2026-08-11",
      sources: [{
        id: "EXT-FIXTURE-001",
        title: "Fixture primary source",
        publisher: "Example Government",
        url,
        publishedOrUpdatedAt: "2026-08-04",
        retrievedAt: "2026-08-11",
        regionScope: "fixture 범위",
        claimIds: [claim.id],
        limitations: "실제 외부 자료가 아니다.",
        primary: true,
      }],
    },
  };
}

function fixtureClaim(fixture) {
  const match = fixture.documents[0][1].match(/```claim\n([\s\S]+)\n```/);
  return JSON.parse(match[1]);
}

function replaceClaim(fixture, claim) {
  fixture.documents[0][1] = `# Fixture\n\n\`\`\`claim\n${JSON.stringify(claim)}\n\`\`\``;
}

test("evidence audit accepts only complete claims with resolvable source IDs", () => {
  const result = spawnSync(process.execPath, ["tooling/audit-evidence.mjs", "--check"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /Evidence audit: PASS/);
  assert.match(result.stdout, /orphan source IDs: 0/);
  assert.match(result.stdout, /evergreen: \d+/);
  assert.match(result.stdout, /contextual: \d+/);
  assert.match(result.stdout, /time-sensitive: \d+/);
});

const invalidFixtures = [
  {
    name: "missing metadata",
    mutate(fixture) {
      const claim = fixtureClaim(fixture);
      delete claim.limitations;
      replaceClaim(fixture, claim);
    },
    expected: /time-sensitive claim requires limitations/,
  },
  {
    name: "impossible claim date",
    mutate(fixture) {
      const claim = fixtureClaim(fixture);
      claim.verifiedAt = "2026-02-30";
      replaceClaim(fixture, claim);
    },
    expected: /verifiedAt must be a valid date/,
  },
  {
    name: "impossible source date",
    mutate(fixture) {
      fixture.register.sources[0].publishedOrUpdatedAt = "2026-04-31";
    },
    expected: /publishedOrUpdatedAt must be a date or null/,
  },
  {
    name: "orphan source ID",
    mutate(fixture) {
      const claim = fixtureClaim(fixture);
      claim.sourceIds.push("EXT-MISSING");
      replaceClaim(fixture, claim);
    },
    expected: /orphan source ID EXT-MISSING/,
  },
  {
    name: "one-sided reverse mapping",
    mutate(fixture) {
      fixture.register.sources[0].claimIds = ["CUR-OTHER-001"];
    },
    expected: /external source mappings differ/,
  },
  {
    name: "invalid review date order",
    mutate(fixture) {
      const claim = fixtureClaim(fixture);
      claim.reviewAfter = claim.verifiedAt;
      replaceClaim(fixture, claim);
    },
    expected: /reviewAfter must be later than verifiedAt/,
  },
  {
    name: "primary URL mismatch",
    mutate(fixture) {
      const claim = fixtureClaim(fixture);
      claim.primaryUrls = ["https://example.gov/different"];
      replaceClaim(fixture, claim);
    },
    expected: /external source URLs differ/,
  },
  {
    name: "source retrieval date drift",
    mutate(fixture) {
      fixture.register.sources[0].retrievedAt = "2026-08-03";
    },
    expected: /retrievedAt must be 2026-08-11/,
  },
];

for (const { name, mutate, expected } of invalidFixtures) {
  test(`evidence audit rejects ${name}`, async () => {
    const fixture = validFixture();
    mutate(fixture);
    const { auditEvidenceData } = await import("../../tooling/audit-evidence.mjs");
    const result = auditEvidenceData(fixture);
    assert.match(result.errors.join("\n"), expected);
  });
}

test("scope and cross-platform synthesis stay within their local evidence", async () => {
  const { auditEvidence } = await import("../../tooling/audit-evidence.mjs");
  const result = await auditEvidence({ repoRoot });
  assert.deepEqual(result.errors, []);

  const claims = new Map(result.claims.map((claim) => [claim.id, claim]));
  const scope = claims.get("CUR-SCOPE-METHOD-001");
  assert.deepEqual(scope.sourceIds, ["career-7143bd076592"]);
  for (const term of ["프로토타입", "가설", "마일스톤", "검증", "중단"]) assert.match(scope.guidance, new RegExp(term));
  assert.doesNotMatch(
    [scope.guidance, scope.applicability, ...scope.counterexamples, scope.limitations ?? ""].join(" "),
    /제작 노력|유지비|의존성|외부 권리|must|should|could|won't/i,
  );

  const cross = claims.get("CUR-CROSS-CHECKLIST-001");
  assert.deepEqual(cross.sourceIds, ["systems-7ccf322de528", "systems-081b21e5d10c", "systems-91d23bacb462"]);
  for (const term of ["입력", "UI 상태", "정보 구조", "플랫폼", "표시", "상호작용"]) assert.match(cross.guidance, new RegExp(term));
  assert.doesNotMatch(
    [cross.guidance, cross.applicability, ...cross.counterexamples, cross.limitations].join(" "),
    /성능 등급|매치 공정성|채팅 안전|스토어 권한|업적|장애 시 복구/,
  );

  const playFab = claims.get("CUR-CROSS-001");
  for (const term of ["계정", "진행", "커뮤니티", "멀티플레이", "LiveOps", "경제", "텔레메트리"]) {
    assert.match(playFab.guidance, new RegExp(term));
  }
  assert.doesNotMatch(playFab.guidance, /입력|UI|성능|공정성|스토어|업적|복구/);
});
