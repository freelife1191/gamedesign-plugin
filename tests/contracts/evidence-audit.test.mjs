import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);

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
      retrievedAt: "2026-08-04",
      sources: [{
        id: "EXT-FIXTURE-001",
        title: "Fixture primary source",
        publisher: "Example Government",
        url,
        publishedOrUpdatedAt: "2026-08-04",
        retrievedAt: "2026-08-04",
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
    expected: /retrievedAt must be 2026-08-04/,
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
