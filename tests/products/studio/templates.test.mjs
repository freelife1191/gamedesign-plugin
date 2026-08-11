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
const templateRoot = path.join(repoRoot, "products/game-design-studio/plugin/assets/templates");
const templateProfileMapPath = path.join(repoRoot, "products/game-design-studio/plugin/references/document-quality/template-profile-map.json");
const temporaryDirs = [];

const templateIds = [
  "game-design-brief",
  "vision-pillars",
  "core-motivation-loop",
  "system-specification",
  "rule-exception-matrix",
  "ui-ux-flow-state",
  "data-schema-table-contract",
  "narrative-quest-npc",
  "character-skill-combat-monster",
  "economy-balance",
  "liveops-experiment-event",
  "accessibility-platform-matrix",
  "production-scope-risk",
  "game-design-review",
  "decision-change-log",
];

const expectedTemplateProfiles = {
  "accessibility-platform-matrix": "accessibility-platform-matrix",
  "character-skill-combat-monster": "character-skill-combat-monster-specification",
  "core-motivation-loop": "core-motivation-loop",
  "data-schema-table-contract": "data-table-contract",
  "decision-change-log": "design-review-decision-log",
  "economy-balance": "economy-balance-specification",
  "game-design-brief": "game-design-brief",
  "game-design-review": "design-review-decision-log",
  "liveops-experiment-event": "liveops-event-experiment-plan",
  "narrative-quest-npc": "narrative-quest-npc-specification",
  "production-scope-risk": "production-scope-milestone-risk-plan",
  "rule-exception-matrix": "rule-state-exception-matrix",
  "system-specification": "system-feature-specification",
  "ui-ux-flow-state": "ui-ux-flow-state-specification",
  "vision-pillars": "vision-one-pager",
};

const requiredFiles = [
  "assets/README.md",
  "content.md",
  "decisions/README.md",
  "evidence.yml",
  "export-manifest.yml",
];

const approvedSeedHashes = {
  "accessibility-platform-matrix/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "accessibility-platform-matrix/content.md": "6657470757ceea1fbde3a7ae78079826b2ea9564883c8489fe30f97fde2b49f4",
  "accessibility-platform-matrix/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "accessibility-platform-matrix/evidence.yml": "5cc40446bea64211ff0c242e49af505826735d253abb51162c005e0f2496ff97",
  "accessibility-platform-matrix/export-manifest.yml": "a0df5b01d7ab4662892bb06b8da1de586a9baa7c313fbeac28be3c491546b56b",
  "character-skill-combat-monster/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "character-skill-combat-monster/content.md": "19880c2211416cbf002b2149415252c78062e5c5e5bae27567d5ab36df8fd764",
  "character-skill-combat-monster/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "character-skill-combat-monster/evidence.yml": "24432843d612e0e87c12bf7e4a352f621d7871dad6ffd7d38d5edfa68ae6b20b",
  "character-skill-combat-monster/export-manifest.yml": "b5a21c28d758fffacebab5eac10187767c8c9f687654130006ba36d8923e69f5",
  "core-motivation-loop/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "core-motivation-loop/content.md": "286dc79baa1ef26536e70069fa740b4bf5a5a3479351ba8937d14d0730790d89",
  "core-motivation-loop/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "core-motivation-loop/evidence.yml": "4ce9d79abe00b9531640ffa28da47f1af8dd727e4a910223080a4e68fc8e30cb",
  "core-motivation-loop/export-manifest.yml": "d35deb851062f21cb36610bb1eef164d5dd21e7ae6a4dce052478074f2e69f02",
  "data-schema-table-contract/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "data-schema-table-contract/content.md": "903116f12af5a33026ec4e059ecfef0bda419960770ccc8e847faa866c4418f6",
  "data-schema-table-contract/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "data-schema-table-contract/evidence.yml": "6a672a07b5b4ff865fdc507f3e6f8af0faf5e6db934f0c7a582c6f1c96452c70",
  "data-schema-table-contract/export-manifest.yml": "ca42b32d884f7f4d22a5aa9dc4197f8bedc053faddf1ab1bb70fd96389971e2d",
  "decision-change-log/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "decision-change-log/content.md": "8eb0897170687b398a102b0a342ac660c862203a0218352974c72a672b31b8ae",
  "decision-change-log/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "decision-change-log/evidence.yml": "fedc034c5c7c3ffe37c7286c612f0ce77919f8caea74c39b8b17605fbfe200ab",
  "decision-change-log/export-manifest.yml": "132eabb61d4b264c2d908c19788071c75a9a04284dbd589dfc5fec2f20d87ed9",
  "economy-balance/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "economy-balance/content.md": "398b1c3d7528d7232bb5339b2c96e0610132651320fa18be95b534cc39ac0c02",
  "economy-balance/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "economy-balance/evidence.yml": "f5660aefba9fc8f67a97a86502a816fa2be16ff446f40c38b311ae8e129a0da7",
  "economy-balance/export-manifest.yml": "aaec2e67c761dd661f8d86175b723e43b9ae897907d574e13b092e1b21fb0ca4",
  "game-design-brief/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "game-design-brief/content.md": "3b24442c646dc85059cb09bc7658a3a42254f05a8801cbeed84ffbe4d5f23a4a",
  "game-design-brief/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "game-design-brief/evidence.yml": "f19bb04d8077ba405dc1b22edb2b2e574d27b00499ea960cbe41e25290ddd5fb",
  "game-design-brief/export-manifest.yml": "3b066e718628dcf059d803dc8be26ca646ae7c7d618b806334b0674f7a5883f3",
  "game-design-review/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "game-design-review/content.md": "ff8f77cf03575d510d8f621d00f25e22f6d17fd3c94f28c872eeaaf9d9b15928",
  "game-design-review/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "game-design-review/evidence.yml": "65bb1f4de923bf3b71ecc9f419cc659c55af18fc4751cda50e4ea33747096c38",
  "game-design-review/export-manifest.yml": "eca03c395d31e0fa49994446a0f7a8f2393cfeb21ccfdc837171611c9fd57aa0",
  "liveops-experiment-event/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "liveops-experiment-event/content.md": "e11113a73983d7582be35b8bbbac29ace46baa543e97e5a319421465492b5251",
  "liveops-experiment-event/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "liveops-experiment-event/evidence.yml": "a89d56b34a05e46354278b564c236d76fca03bff2332567415fef29c2f80c148",
  "liveops-experiment-event/export-manifest.yml": "b6934f5d78951b0840436297658717f0404ef9dd3eda905a446698855c666a22",
  "narrative-quest-npc/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "narrative-quest-npc/content.md": "ebd0d6286048e11b5e31304a77e4b3593d8f84076842c0793854a1c077f043de",
  "narrative-quest-npc/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "narrative-quest-npc/evidence.yml": "5204b30729fa4ada897664e433791500acef62f490719427c1be269e941fc56e",
  "narrative-quest-npc/export-manifest.yml": "3ac51fc84152a138b78f5df7c62cb6778589869886e12e7fd834716fe16a2c48",
  "production-scope-risk/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "production-scope-risk/content.md": "43041d2007b61f51d10dbc9dd2e88c6c09319524f2e82bbcce72ab4847a6fb26",
  "production-scope-risk/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "production-scope-risk/evidence.yml": "cb6f05e00e3fab3b9c58e1550ca54893d179d68098393eeb52c3698c25d196c2",
  "production-scope-risk/export-manifest.yml": "83e311c5d931b49bd329a615ec81bfdd217605fd328cc355c92bbb879bf7ad36",
  "rule-exception-matrix/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "rule-exception-matrix/content.md": "4b6eb33a3efdce250576975e815a9ed3cf52ca106251e086b5d43fa94f37070d",
  "rule-exception-matrix/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "rule-exception-matrix/evidence.yml": "72838c93aadc5f48751dce8ff2e484d53dbcde4438b67a11b38513d26d8880c9",
  "rule-exception-matrix/export-manifest.yml": "c286f34b582856310e947cbe99cc8094d9964552fbd08c61cdadf4a2aa18fc3f",
  "system-specification/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "system-specification/content.md": "80ebfefe05328303e617851ed2f9a1afe1f28338d446a1f7eecfb8ac4e011e5e",
  "system-specification/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "system-specification/evidence.yml": "a22c6454fb2b8a1f2a5a3e7c5b6c3ffef5a69535454a04115cfeae15b3b40263",
  "system-specification/export-manifest.yml": "b78dd77c281917c2e7e1099912d9144d8510b9e10621881d78008055d0e1bdf0",
  "ui-ux-flow-state/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "ui-ux-flow-state/content.md": "0010122c42ac2a46f30bfd69c1324acae9a4926ba1fe928b059db00f3471edb5",
  "ui-ux-flow-state/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "ui-ux-flow-state/evidence.yml": "9b571c210e2417bebb5a9eb614d87269d75996f1b39399c0d7c410514581e040",
  "ui-ux-flow-state/export-manifest.yml": "365df35e89ce4faa3b109aca775e7a0ffafc3f18dbe91ff2f14b49b5112c093d",
  "vision-pillars/assets/README.md": "e25ac94a94e787459d566e42b305bdac4379a453b9b48a4765767cb35b5b9e56",
  "vision-pillars/content.md": "958987e8678ea5525b7275e8d2808933e6f57643ebf399af8e2848ef4e4acb97",
  "vision-pillars/decisions/README.md": "1dc750c01fdffc96fbf1f4a803bdd788df6c5a285cad5f6c8e80d41292d122ad",
  "vision-pillars/evidence.yml": "5a32187a996c28f8d3042aa333865254037664eb7218b72e258c4db255af9bdc",
  "vision-pillars/export-manifest.yml": "f48e93574eb4b19076afaaf9740c41472d1bae6fe2fcc0c2568b06739180b3b2",
};

const contracts = {
  "game-design-brief": {
    fields: ["target-player", "experience-intent", "platform", "genre", "business-model", "core-loop", "scope", "non-goals", "success-metric", "owner"],
    sections: [
      ["brief-contract", "승인 전에 목표 플레이어, 경험 의도, 목표 감정, 플랫폼, 장르, 비즈니스 모델, 온라인 모드, 핵심 루프, 범위, 비목표, 성공 지표, 제약 조건, 담당자를 정의한다."],
      ["release-boundary", "콘셉트는 임시 상태로 남을 수 있다. 목표 경험, 프로토타입 근거, 담당자, 성공 기준이 빠졌다면 프로덕션 투입을 승인하지 않는다."],
    ],
  },
  "vision-pillars": {
    fields: ["pillar-id", "player-promise", "design-rule", "anti-pillar", "evidence-id", "success-signal", "owner"],
    sections: [
      ["vision-and-pillars", "각 pillar-id에 목표 플레이어 약속, 목표 감정, 핵심 재미, 유의미한 선택, 디자인 원칙, 배제 원칙, evidence-id, 성공 신호, 담당자를 연결한다."],
      ["unsupported-fun-boundary", "재미를 나타내는 형용사는 근거가 아니라 가설이다. 가정을 드러내고 승인 전에 관찰 가능한 플레이어 행동 또는 테스트를 요구한다."],
    ],
  },
  "core-motivation-loop": {
    fields: ["loop-step", "player-input", "system-response", "feedback", "reward", "motivation-need", "meaningful-choice", "failure-recovery", "metric"],
    sections: [
      ["loop-contract", "각 loop-step에서 발동 조건, 플레이어 입력, 시스템 반응, 피드백, 보상, 동기 욕구, 유의미한 선택, 반복, 실패·복구, 측정 가능한 결과를 추적한다."],
      ["compulsion-safety", "유의미한 선택을 가려진 확률, 강요하는 긴급성, 손실 프레이밍, 끝없는 단계 상승으로 대체하지 않는다. 중단 조건과 플레이어 보호 지표를 기록한다."],
    ],
  },
  "system-specification": {
    fields: ["rule-id", "input", "precondition", "state-transition", "output", "feedback", "precedence", "exception", "failure-recovery", "data-runtime-mapping"],
    sections: [
      ["system-contract", "각 rule-id에 입력, 사전 조건, 규칙, 상태 전이, 출력, 피드백, 예외, 우선순위, 동시성, 실패, 복구, 악용 사례, UI 상태, 담당자를 명시한다."],
      ["precedence-and-runtime-mapping", "규칙 우선순위는 명시적으로 해결한다. 각 기획 항목을 데이터 출처, 테이블 또는 스키마 키, 런타임 소비처, 권한, 동기화 규칙, 검증 방법, 롤백 경로에 매핑한다."],
    ],
  },
  "rule-exception-matrix": {
    fields: ["rule-id", "priority", "condition", "exception-id", "concurrency", "authority", "failure", "recovery", "test-case"],
    sections: [
      ["rule-and-exception-order", "모든 rule-id와 exception-id에 결정적인 우선순위, 조건, 권한, 동시성 동작, 충돌 해결 방식, 실패 상태, 복구 조치, 테스트 케이스를 부여한다."],
      ["conflict-boundary", "서로 모순되는 규칙을 문서 순서나 명시되지 않은 직관으로 해결하지 않는다. 해결되지 않은 우선순위는 구현 승인을 막고 결정 기록으로 남긴다."],
    ],
  },
  "ui-ux-flow-state": {
    fields: ["state-id", "entry-condition", "information-priority", "critical-action", "input", "loading-empty-error", "exit-condition", "accessibility", "telemetry"],
    sections: [
      ["flow-and-state-contract", "각 state-id에 진입 조건, 정보 우선순위, 핵심 행동, 입력, 포커스 순서, 로딩·빈 상태·오류·오프라인·중단·복구 처리, 이탈 조건, 텔레메트리를 기록한다."],
      ["access-to-critical-actions", "핵심 행동에는 키보드 또는 컨트롤러 접근, 보이는 포커스, 색상만으로 제한되지 않는 읽기 쉬운 상태 표시, 조절 가능한 글자 크기, 소리가 의미를 전달할 때의 자막, 접근 가능한 복구 경로가 필요하다."],
    ],
  },
  "data-schema-table-contract": {
    fields: ["field-id", "table", "primary-key", "foreign-key", "type-range", "default-null", "design-meaning", "runtime-consumer", "authority-sync", "migration-validation"],
    sections: [
      ["schema-contract", "각 field-id에 테이블, 기본 키, 외래 키, 타입·범위, 기본값·null 정책, 기획상 의미, 단일 출처, 런타임 소비처, 권한·동기화, 마이그레이션, 검증, 롤백을 기록한다."],
      ["design-to-runtime-boundary", "정확한 테이블 또는 스키마 키가 없는 라벨은 런타임 매핑이 아니다. 스키마 변경에는 호환성, 소유권, 마이그레이션, 관측성, 롤백 근거가 필요하다."],
    ],
  },
  "narrative-quest-npc": {
    fields: ["content-id", "player-purpose", "entry-condition", "choice-consequence", "quest-state", "npc-state", "telegraph", "reward", "repeatability", "rights-consent"],
    sections: [
      ["narrative-content-contract", "각 content-id에 플레이어 목적, 시스템 입력, 제작 리소스, 진입 조건, 선택과 결과, 퀘스트 상태, NPC 상태, 텔레그래프, 결과, 보상, 반복 가능 여부, 담당자를 연결한다."],
      ["ai-and-ugc-rights-boundary", "AI 생성·출연자 유래·사용자 생성 자료를 사용할 때는 출시 전에 출처, 제작자 또는 기여자, 출처 표기, 사용 목적, 권리 또는 동의, 개인정보, 모더레이션, 승인자, 철회 경로를 기록한다."],
    ],
  },
  "character-skill-combat-monster": {
    fields: ["entity-id", "combat-role", "player-strategy", "input-timing", "state-rule", "telegraph", "counterplay", "failure-recovery", "data-key", "balance-test"],
    sections: [
      ["combat-content-contract", "각 entity-id에 전투 역할, 플레이어 전략, 입력 타이밍, 상태 규칙, 텔레그래프, 대응 수단, 결과, 보상, 실패·복구, 데이터 키, 제작 비용, 밸런스 테스트를 연결한다."],
      ["fairness-and-readability", "핵심 위협에는 인지 가능한 텔레그래프, 일관된 규칙 우선순위, 색상이나 소리만으로 제한되지 않는 접근성 신호, 제한된 무작위성, 테스트 가능한 대응 시간을 둔다."],
    ],
  },
  "economy-balance": {
    fields: ["resource-id", "source", "sink", "target-inventory", "progression-time", "real-price", "probability", "pity", "inflation-risk", "rollback"],
    sections: [
      ["economy-contract", "각 resource-id에 획득처, 소비처, 목표 보유량, 성장 소요 시간, 교환 규칙, 세분화 한도, 인플레이션·악용 위험, 텔레메트리, 담당자, 검토 주기를 기록한다."],
      ["price-probability-and-recovery-gate", "실제 가격 표시, 확률 고지, 천장 또는 보장 동작, 구매 확인, 환불 범위, 이상 탐지, 중단 조건, 롤백이 명확하고 현행 정책 근거가 연결되기 전에는 출시를 승인하지 않는다."],
    ],
  },
  "liveops-experiment-event": {
    fields: ["experiment-id", "hypothesis", "control", "single-variable", "sample", "duration", "success", "guardrail", "stop-condition", "rollback"],
    sections: [
      ["experiment-contract", "모든 experiment-id에는 반증 가능한 가설 하나, 대조군, 변경 변수 하나, 대상 표본, 제외 조건, 기간, 성공 지표, 가드레일 지표, 분석 담당자, 의사결정 규칙이 필요하다."],
      ["protection-and-rollback-gate", "필요한 동의 또는 정책 근거, 플레이어 보호 지표, 중단 조건, 롤백 담당자, 복구 절차, 오염 여부 확인, 결론이 나지 않을 때의 계획이 없으면 시작하지 않는다."],
    ],
  },
  "accessibility-platform-matrix": {
    fields: ["platform", "critical-action", "input-method", "focus-navigation", "visual-alternative", "audio-alternative", "text-scale", "performance", "offline-interruption", "verification"],
    sections: [
      ["platform-access-matrix", "플랫폼과 핵심 행동별로 입력 방식, 키 재지정, 포커스 이동, 시각·청각 대체 수단, 글자 크기, 모션·햅틱 옵션, 성능 예산, 안전 영역, 오프라인·중단 시 동작, 검증 결과를 기록한다."],
      ["accessibility-completion-gate", "지원 플랫폼에서 필수 상태·신호·입력 경로·복구 경로·동등한 감각 대체 수단 중 하나라도 없거나 검증되지 않았다면 핵심 행동은 완료되지 않았다."],
    ],
  },
  "production-scope-risk": {
    fields: ["scope-id", "core-loop-contribution", "moscow", "effort", "dependency", "maintenance", "rights-outsource-risk", "prototype-hypothesis", "definition-of-done", "kill-criterion"],
    sections: [
      ["scope-and-risk-contract", "각 scope-id에 핵심 루프 기여도, MoSCoW 분류, 소요 공수, 의존성, 유지보수 부담, 라이선스 또는 외주 위험, 프로토타입 가설, 마일스톤, 담당자, 완료 정의, 중단 기준을 기록한다."],
      ["commitment-gate", "목표 경험 근거, 프로토타입 결과, 가용 인력 근거, 명시된 담당자, 측정 가능한 완료 정의, 중단 기준, 비상 계획, 재개 조건이 없으면 큰 규모의 투입을 승인하지 않는다."],
    ],
  },
  "game-design-review": {
    fields: ["finding-id", "severity", "evidence-id", "impact", "section-id", "minimal-fix", "role", "status", "decision-id"],
    sections: [
      ["review-finding-contract", "모든 finding-id에는 심각도, evidence-id, 관찰된 영향, 영향받는 안정 섹션 ID, 최소 수정안, 검토자 역할, 상태, 미해결 이견의 decision-id를 기록한다."],
      ["review-boundary", "검토자는 범위가 정해진 이슈와 최소 수정안을 제시한다. 산출물 전체를 다시 쓰거나, 근거를 만들어 내거나, 충돌하는 가정 중 하나를 임의로 선택하거나, 승인을 부여하지 않는다."],
    ],
  },
  "decision-change-log": {
    fields: ["decision-id", "date", "owner", "status", "context", "alternatives", "evidence-ids", "rationale", "approver", "reopen-condition"],
    sections: [
      ["decision-contract", "모든 decision-id에는 날짜, 담당자, 상태, 맥락, 대안, 근거 ID, 근거, 영향, 승인자, 승인일, 재개 조건을 기록한다."],
      ["change-traceability", "중요한 변경마다 영향받는 안정 섹션 ID, 이전 결정, 새 근거, 호환성 또는 마이그레이션 영향, 롤백 경로, 다음 검토일을 연결한다."],
    ],
  },
};

const commonClauses = [
  "가정은 승인된 사실이 아니다.",
  "자동화는 승인·권리 부여·동의를 대신할 수 없다.",
  "현재성을 주장하려면 날짜가 있는 1차 출처, 조회일, 지역 또는 적용 범위, 재검토일, 갱신 담당자가 필요하다.",
  "제3자·AI 생성·출연자 유래·사용자 생성 자료에는 출처, 제작자 또는 기여자, 출처 표기, 사용 목적, 권리 또는 동의, 개인정보, 승인자, 철회 상태를 기록한다.",
  "Markdown을 제목 단위로 기계적으로 분리하지 않는다.",
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

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/u);
  assert.ok(match, "content must start with frontmatter");
  return parseRestrictedYaml(match[1], "content.md frontmatter");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertApprovedSeed(relativePath, bytes, expectedHash) {
  assert.match(expectedHash, /^[a-f0-9]{64}$/u, `${relativePath}: caller must pass an expected SHA-256`);
  assert.equal(expectedHash, approvedSeedHashes[relativePath], `${relativePath}: expected hash must come from the approved map`);
  assert.equal(sha256(bytes), expectedHash, `${relativePath}: approved seed bytes`);
}

function assertTemplateContract(templateId, content, evidence, manifest) {
  assert.equal(
    createHash("sha256").update(content, "utf8").digest("hex"),
    approvedSeedHashes[`${templateId}/content.md`],
    `${templateId}: approved content seed bytes`,
  );
  const metadata = parseFrontmatter(content);
  assert.equal(metadata.artifact_id, templateId);
  assert.match(content, /^# .+ \{#[a-z0-9-]+\}$/mu);
  assertStableSection(content, "working-record");
  assertStableSection(content, "assumptions-and-boundaries");
  assertStableSection(content, "owners-and-approvals");
  assertStableSection(content, "evidence-and-freshness");
  assertStableSection(content, "applicable-safety-gates");
  assertStableSection(content, "output-story-hints");
  assertStableSection(content, "change-history");
  assert.doesNotMatch(content, /\b(?:TODO|TBD|lorem ipsum|fill this|placeholder)\b/iu);

  for (const [id, meaning] of contracts[templateId].sections) {
    assert.equal(semanticSection(content, id), meaning, `${templateId}: ${id}`);
  }
  for (const clause of commonClauses) assert.ok(content.includes(clause), `${templateId}: ${clause}`);

  const actualFields = content
    .split("\n")
    .filter((line) => /^\| `[^`]+` \|/u.test(line))
    .map((line) => line.split("|")[1].trim().replaceAll("`", ""));
  assert.deepEqual(actualFields, contracts[templateId].fields, `${templateId}: exact working fields`);

  assert.equal(evidence.version, 1);
  assert.equal(evidence.claims[0].id, `claim-${templateId}`);
  assert.equal(evidence.claims[0].source.locator, "content.md");
  assert.equal(manifest.artifact_id, templateId);
  assert.equal(metadata.artifact_id, manifest.artifact_id);
  assert.deepEqual(Object.keys(manifest.formats).sort(), ["docx", "md", "pdf", "pptx"]);
  assert.ok(manifest.formats.pptx.audience.trim());
  assert.ok(manifest.formats.pptx.purpose.trim());
  assert.ok(manifest.formats.pptx.slide_outline.length >= 3);
}

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
  const target = await mkdtemp(path.join(os.tmpdir(), `studio-template-${templateId}-`));
  temporaryDirs.push(target);
  await cp(path.join(templateRoot, templateId), target, { recursive: true });
  return target;
}

async function replaceIn(root, relativePath, before, after) {
  const file = path.join(root, relativePath);
  const source = await readFile(file, "utf8");
  assert.ok(source.includes(before));
  await writeFile(file, source.replace(before, after), "utf8");
}

async function assertSeedMutationRejected(templateId, relativeFile, before, after) {
  const approvedPath = `${templateId}/${relativeFile}`;
  const expectedHash = approvedSeedHashes[approvedPath];
  const source = await readFile(path.join(templateRoot, approvedPath), "utf8");
  assertApprovedSeed(approvedPath, source, expectedHash);
  assert.ok(source.includes(before), `${approvedPath}: mutation source text`);
  const mutated = source.replace(before, after);
  assert.notEqual(mutated, source, `${approvedPath}: mutation must change bytes`);
  assert.throws(() => assertApprovedSeed(approvedPath, mutated, expectedHash), undefined, `${approvedPath}: mutation survived`);
}

async function instantiateTemplate(templateId) {
  const fixture = await temporaryTemplate(templateId);
  const contentPath = path.join(fixture, "content.md");
  let content = await readFile(contentPath, "utf8");
  for (const field of contracts[templateId].fields) {
    const seedRow = `| \`${field}\` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 기록한다. | artifact-owner |`;
    const projectRow = `| \`${field}\` | observed | Project Ember records a reviewed value for ${field} under claim-${templateId}. | studio-lead |`;
    assert.ok(content.includes(seedRow), `${templateId}: seed row ${field}`);
    content = content.replace(seedRow, projectRow);
  }
  content = content.replace(
    "각 가정에는 안정 ID, 근거 상태, 담당자, 검증 작업, 영향받는 결정, 만료일 또는 재검토일을 기록한다. 가정은 승인된 사실이 아니다.",
    "Project Ember 가정 A-001은 임시 상태이며 studio-lead가 담당한다. 프로토타입 세션 P-014로 검증하고 결정 D-001에 연결하며 2026-08-18에 재검토한다. 가정은 승인된 사실이 아니다.",
  );
  content = content.replace(
    "Name the artifact owner, evidence reviewer, discipline approvers, player-safety or accessibility reviewer where applicable, approval status, approval date, and reopen condition. Automation cannot grant approval, rights, or consent.",
    "Artifact owner: studio-lead. Evidence reviewer: research-lead. Discipline approver: design-director. Player-safety and accessibility reviewer: access-lead. Approval status: approved for prototype on 2026-08-04; reopen if evidence P-014 changes. Automation cannot grant approval, rights, or consent.",
  );
  content = content.replace(
    "| 1 | 2026-08-04 | artifact-owner | 검토 가능한 프로덕션 디자인 초안과 완료 기준을 만들었다. | pending human review |",
    "| 2 | 2026-08-04 | studio-lead | Instantiated Project Ember values, evidence, approval, and export story. | approved for prototype by design-director |",
  );
  await writeFile(contentPath, content, "utf8");

  await writeFile(path.join(fixture, "evidence.yml"), `version: 1
claims:
  - id: claim-${templateId}
    claim_type: project-design-evidence
    claim: Project Ember contains reviewed representative values for every ${templateId} working field.
    source:
      title: Project Ember prototype review P-014
      locator: content.md#working-record
      accessed_at: 2026-08-04
    confidence: medium
    limitations: |
      Prototype evidence supports design review only. Production and release approval remain governed by the artifact safety gates.
`, "utf8");

  const manifestPath = path.join(fixture, "export-manifest.yml");
  const manifest = (await readFile(manifestPath, "utf8"))
    .replace(/^    audience: .+$/mu, "    audience: Project Ember design review board")
    .replace(/^    purpose: .+$/mu, `    purpose: Decide Project Ember ${templateId} prototype readiness from evidence and safety gates.`)
    .replace("      - title: Context and target experience", "      - title: Project Ember context and target experience")
    .replace("      - title: Design decision and alternatives", "      - title: Project Ember decision and alternatives")
    .replace("      - title: Evidence risks and completion gate", "      - title: Project Ember evidence risks and completion gate");
  await writeFile(manifestPath, manifest, "utf8");

  await writeFile(path.join(fixture, "decisions/README.md"), `# Decision D-001 {#decision-d-001}

Date: 2026-08-04. Owner: studio-lead. Status: approved for prototype. Context: instantiate ${templateId} for Project Ember. Alternatives considered: keep the seed uninstantiated or defer review. Evidence IDs: claim-${templateId}. Rationale: a representative artifact is required for validation. Consequences: production and release remain gated. Affected stable section IDs: working-record and owners-and-approvals. Approver: design-director. Approval date: 2026-08-04. Rollback path: restore the approved seed. Reopen condition: prototype evidence P-014 changes.
`, "utf8");

  return fixture;
}

function errors(result) {
  return result.errors.map(({ message }) => message).join("\n");
}

afterEach(async () => {
  await Promise.all(temporaryDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

test("exactly 15 approved Studio templates ship as complete five-file seeds", async () => {
  assert.deepEqual((await readdir(templateRoot)).sort(), [...templateIds].sort());
  for (const templateId of templateIds) {
    const root = path.join(templateRoot, templateId);
    assert.deepEqual(await filesBelow(root), requiredFiles);
    for (const relativePath of requiredFiles) {
      assert.equal((await lstat(path.join(root, relativePath))).isFile(), true);
      assert.ok((await readFile(path.join(root, relativePath), "utf8")).trim());
    }
  }
});

test("all 15 Studio templates resolve to exactly one declared primary quality profile", async () => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-template-profile-build-"));
  temporaryDirs.push(stagingRoot);
  const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  const packagedTemplateRoot = path.join(build.outputDir, "assets/templates");
  const packagedCatalogRoot = path.join(build.outputDir, "references/shared/document-quality/profiles/studio");
  const mappingSource = await readFile(templateProfileMapPath, "utf8").catch(() => null);
  assert.notEqual(mappingSource, null, "Studio template profile mapping must exist");
  const packagedMappingSource = await readFile(path.join(build.outputDir, "references/document-quality/template-profile-map.json"), "utf8");
  assert.equal(packagedMappingSource, mappingSource, "clean build must preserve the mapping bytes");
  const mapping = JSON.parse(packagedMappingSource);
  assert.deepEqual(Object.keys(mapping).sort(), ["product", "schema_version", "templates"]);
  assert.equal(mapping.schema_version, 1);
  assert.equal(mapping.product, "game-design-studio");
  assert.deepEqual(mapping.templates, expectedTemplateProfiles);
  assert.deepEqual(Object.keys(mapping.templates).sort(), (await readdir(packagedTemplateRoot)).sort());

  for (const [templateId, profileId] of Object.entries(mapping.templates)) {
    assert.equal(typeof profileId, "string", `${templateId}: primary profile must be one string`);
    const profile = JSON.parse(await readFile(path.join(packagedCatalogRoot, `${profileId}.json`), "utf8"));
    const profileValidation = validateQualityProfile(profile, { sourceName: `${profileId}.json` });
    assert.equal(profileValidation.ok, true, `${profileId}: ${JSON.stringify(profileValidation.errors)}`);
    assert.equal(profile.profile_id, profileId, `${templateId}: catalog resolution`);

    const content = await readFile(path.join(packagedTemplateRoot, templateId, "content.md"), "utf8");
    assert.equal(parseFrontmatter(content).quality_profile, profileId, `${templateId}: frontmatter mapping`);
    const result = await validateArtifact(path.join(packagedTemplateRoot, templateId), {
      requireQualityProfile: true,
      profileCatalogRoot: packagedCatalogRoot,
    });
    assert.equal(result.ok, true, `${templateId}: ${errors(result)}`);
  }
});

test("every seed validates through the production Canonical Artifact validator", async () => {
  for (const templateId of templateIds) {
    const root = path.join(templateRoot, templateId);
    const result = await validateArtifact(root, { requestedFormats: ["md", "pdf", "docx", "pptx"] });
    assert.equal(result.ok, true, `${templateId}: ${errors(result)}`);
    assertTemplateContract(
      templateId,
      await readFile(path.join(root, "content.md"), "utf8"),
      parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8")),
      parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8")),
    );
  }
});

test("every template instantiates with representative project data and remains a valid Canonical Artifact", async () => {
  for (const templateId of templateIds) {
    const fixture = await instantiateTemplate(templateId);
    const result = await validateArtifact(fixture, { requestedFormats: ["md", "pdf", "docx", "pptx"] });
    assert.equal(result.ok, true, `${templateId}: ${errors(result)}`);

    const content = await readFile(path.join(fixture, "content.md"), "utf8");
    const metadata = parseFrontmatter(content);
    const evidence = parseRestrictedYaml(await readFile(path.join(fixture, "evidence.yml"), "utf8"));
    const manifest = parseRestrictedYaml(await readFile(path.join(fixture, "export-manifest.yml"), "utf8"));
    assert.equal(metadata.artifact_id, templateId);
    assert.equal(manifest.artifact_id, templateId);
    assert.equal(evidence.claims[0].id, `claim-${templateId}`);
    assert.match(content, /Project Ember/u);
    assert.match(content, /approved for prototype by design-director/u);
    assert.match(manifest.formats.pptx.audience, /Project Ember/u);
    assert.match(manifest.formats.pptx.purpose, new RegExp(templateId, "u"));
    assert.deepEqual(
      content.split("\n").filter((line) => /^\| `[^`]+` \|/u.test(line)).map((line) => line.split("|")[1].trim().replaceAll("`", "")),
      contracts[templateId].fields,
      `${templateId}: instantiated required fields`,
    );
    for (const [id, meaning] of contracts[templateId].sections) {
      assert.equal(semanticSection(content, id), meaning, `${templateId}: instantiated ${id}`);
    }
  }
});

test("clean product build preserves every template byte-for-byte", async () => {
  const exactSeedPaths = templateIds.flatMap((templateId) => requiredFiles.map((relativeFile) => `${templateId}/${relativeFile}`)).sort();
  assert.deepEqual(Object.keys(approvedSeedHashes).sort(), exactSeedPaths);
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-template-build-"));
  temporaryDirs.push(stagingRoot);
  const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  const hashes = {};
  for (const templateId of templateIds) {
    for (const relativeFile of requiredFiles) {
      const source = await readFile(path.join(templateRoot, templateId, relativeFile));
      const built = await readFile(path.join(build.outputDir, "assets/templates", templateId, relativeFile));
      assert.deepEqual(built, source, `${templateId}/${relativeFile}`);
      const approvedPath = `${templateId}/${relativeFile}`;
      hashes[approvedPath] = sha256(source);
      assertApprovedSeed(approvedPath, source, approvedSeedHashes[approvedPath]);
      assertApprovedSeed(approvedPath, built, approvedSeedHashes[approvedPath]);
    }
  }
  assert.equal(Object.keys(hashes).length, 75);
  assert.equal(new Set(Object.values(hashes)).size > 30, true, "seeds must not be generic copies");
});

test("semantic direction and artifact identity cannot be diluted or contradicted", async () => {
  const cases = [
    ["system-specification", "규칙 우선순위는 명시적으로 해결한다.", "Rule precedence may remain implicit."],
    ["economy-balance", "실제 가격 표시, 확률 고지, 천장 또는 보장 동작, 구매 확인, 환불 범위, 이상 탐지, 중단 조건, 롤백이 명확하고 현행 정책 근거가 연결되기 전에는 출시를 승인하지 않는다.", "Release approval is allowed before"],
    ["liveops-experiment-event", "필요한 동의 또는 정책 근거", "동의나 정책 근거 없이 시작한다"],
    ["ui-ux-flow-state", "핵심 행동에는 키보드 또는 컨트롤러 접근", "핵심 행동에는 접근성 지원이 필요 없다"],
    ["production-scope-risk", "목표 경험 근거", "목표 경험 근거 없이 큰 규모의 투입을 승인한다"],
    ["narrative-quest-npc", "출처, 제작자 또는 기여자", "출처와 권리를 확인하지 않는다"],
  ];
  for (const [templateId, before, after] of cases) {
    const root = path.join(templateRoot, templateId);
    const content = await readFile(path.join(root, "content.md"), "utf8");
    const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
    const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
    const mutated = content.replace(before, after);
    assert.notEqual(mutated, content);
    assert.throws(() => assertTemplateContract(templateId, mutated, evidence, manifest));
  }

  const templateId = "game-design-brief";
  const root = path.join(templateRoot, templateId);
  const content = await readFile(path.join(root, "content.md"), "utf8");
  const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
  const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
  const spoofed = content.replace("artifact_id: game-design-brief", "artifact_id: vision-pillars")
    .concat("\nExpected artifact identity: game-design-brief\n");
  assert.throws(() => assertTemplateContract(templateId, spoofed, evidence, manifest));

  const economyId = "economy-balance";
  const economyRoot = path.join(templateRoot, economyId);
  const economy = await readFile(path.join(economyRoot, "content.md"), "utf8");
  const economyEvidence = parseRestrictedYaml(await readFile(path.join(economyRoot, "evidence.yml"), "utf8"));
  const economyManifest = parseRestrictedYaml(await readFile(path.join(economyRoot, "export-manifest.yml"), "utf8"));
  const contradiction = `${economy}\n## Unsafe Exception {#unsafe-exception}\n\nReal-price, probability, pity, stop, and rollback details may be omitted before release.\n`;
  assert.throws(() => assertTemplateContract(economyId, contradiction, economyEvidence, economyManifest));
});

test("generic tokens cannot replace exact type semantics", async () => {
  const templateId = "liveops-experiment-event";
  const root = path.join(templateRoot, templateId);
  const content = await readFile(path.join(root, "content.md"), "utf8");
  const evidence = parseRestrictedYaml(await readFile(path.join(root, "evidence.yml"), "utf8"));
  const manifest = parseRestrictedYaml(await readFile(path.join(root, "export-manifest.yml"), "utf8"));
  const generic = content.replace(
    contracts[templateId].sections[0][1],
    "hypothesis control single-variable sample duration success guardrail stop-condition rollback.",
  );
  assert.throws(() => assertTemplateContract(templateId, generic, evidence, manifest));
});

test("all five seed-file contracts reject safety and workflow meaning reversals", async () => {
  await assertSeedMutationRejected(
    "game-design-brief",
    "evidence.yml",
    "Replace it with project-specific evidence before approving design, production, release, monetization, experiment, rights, consent, or accessibility claims.",
    "Release may proceed without project-specific evidence or completion boundaries.",
  );
  await assertSeedMutationRejected(
    "vision-pillars",
    "export-manifest.yml",
    "Explain the player promise, design pillars, anti-pillars, evidence, and success signals.",
    "Make some slides.",
  );
  await assertSeedMutationRejected(
    "system-specification",
    "decisions/README.md",
    "A pending approval remains visibly pending.",
    "Automation may approve decisions without evidence.",
  );
  await assertSeedMutationRejected(
    "narrative-quest-npc",
    "assets/README.md",
    "Do not add an asset until those fields are reviewable.",
    "Unlicensed assets may be added without attribution or consent.",
  );
});

test("production validation rejects unsafe YAML, traversal, missing assets, and symlink assets", async () => {
  const unsafeYaml = await temporaryTemplate("game-design-brief");
  await replaceIn(unsafeYaml, "evidence.yml", "version: 1", "__proto__: poisoned\nversion: 1");
  let result = await validateArtifact(unsafeYaml);
  assert.equal(result.ok, false);
  assert.match(errors(result), /unsafe mapping key/i);

  for (const unsafePath of ["../outside.svg", "assets/../../outside.svg", "/tmp/outside.svg"]) {
    const fixture = await temporaryTemplate("vision-pillars");
    await replaceIn(fixture, "content.md", "이 초안에는 승인된 다이어그램이 없다.", `![Vision map](${unsafePath})`);
    result = await validateArtifact(fixture);
    assert.equal(result.ok, false);
    assert.match(errors(result), /relative local asset|inside assets/i);
  }

  const missing = await temporaryTemplate("core-motivation-loop");
  await replaceIn(missing, "content.md", "이 초안에는 승인된 다이어그램이 없다.", "![Loop](assets/missing.svg)");
  result = await validateArtifact(missing);
  assert.equal(result.ok, false);
  assert.match(errors(result), /does not exist/i);

  const linked = await temporaryTemplate("system-specification");
  const outside = path.join(linked, "..", "outside.svg");
  await writeFile(outside, '<svg xmlns="http://www.w3.org/2000/svg"></svg>', "utf8");
  await symlink(outside, path.join(linked, "assets/linked.svg"));
  await replaceIn(linked, "content.md", "이 초안에는 승인된 다이어그램이 없다.", "![System](assets/linked.svg)");
  result = await validateArtifact(linked);
  assert.equal(result.ok, false);
  assert.match(errors(result), /does not exist/i);
});
