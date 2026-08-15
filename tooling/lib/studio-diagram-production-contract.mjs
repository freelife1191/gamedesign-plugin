function stableJson(value) {
  return JSON.stringify(value);
}

function assertProductionValue(source, field, actual, expected) {
  if (stableJson(actual) !== stableJson(expected)) {
    throw new TypeError(`${source.id} production contract mismatch: ${field}`);
  }
}

function assertCanonicalRouteValue(routeId, field, actual, expected) {
  if (stableJson(actual) !== stableJson(expected)) {
    throw new TypeError(`${routeId} canonical route mismatch: ${field}`);
  }
}

export const STUDIO_DIAGRAM_PRODUCTION_CONTRACT = Object.freeze({
  "st-c01": { kind: "competency", specialist: "define-game-vision", outputs: ["vision-pillars", "game-design-brief", "game-design-review"], review: { skill: "review-game-design", condition: "지정된 책임자가 근거·가정·중단 사유를 검토" } },
  "st-c02": { kind: "competency", specialist: "design-game-systems", outputs: ["core-motivation-loop", "system-specification", "game-design-review"], review: { skill: "review-game-design", condition: "named owner가 근거·가정·blocker를 검토" } },
  "st-c03": { kind: "competency", specialist: "design-game-systems", outputs: ["system-specification", "rule-exception-matrix", "data-schema-table-contract"], review: { skill: "review-game-design", condition: "named owner가 근거·가정·blocker를 검토" } },
  "st-c04": { kind: "competency", specialist: "design-player-experience", outputs: ["ui-ux-flow-state", "accessibility-platform-matrix", "game-design-review"], review: { skill: "review-game-design", condition: "named owner가 근거·가정·blocker를 검토" } },
  "st-c05": { kind: "competency", specialist: "design-game-content", outputs: ["narrative-quest-npc", "character-skill-combat-monster", "game-design-review"], review: { skill: "review-game-design", condition: "named owner가 근거·가정·blocker를 검토" } },
  "st-c06": { kind: "competency", specialist: "design-game-content", outputs: ["character-skill-combat-monster", "system-specification", "game-design-review"], review: { skill: "review-game-design", condition: "named owner가 근거·가정·blocker를 검토" } },
  "st-c07": { kind: "competency", specialist: "design-game-economy-and-liveops", outputs: ["economy-balance", "liveops-experiment-event", "game-design-review"], review: { skill: "review-game-design", condition: "named owner가 근거·가정·blocker를 검토" } },
  "st-c08": { kind: "competency", specialist: "plan-game-production", outputs: ["production-scope-risk", "game-design-review", "export-preparation-manifest"], review: { skill: "review-game-design", condition: "named owner가 근거·가정·blocker를 검토" } },
  "st-g01": { kind: "concept", specialist: "design-game-economy-and-liveops", outputs: ["game-design-brief", "economy-balance", "liveops-experiment-event"], constraint: ["수집 동기", "짧은 세션을 확인합니다."], criterion: ["guardrail 결정", "보호 기준을 비교합니다."], decision: ["이벤트 검증", "rollback을 봅니다."], branches: [["수집 압력 축소", "보호 지표 우선"], ["이벤트 교환 유지", "rollback 기준 확인"]], validation: "telemetry: retention·economy guardrail·rollback" },
  "st-g02": { kind: "concept", specialist: "design-game-systems", outputs: ["core-motivation-loop", "ui-ux-flow-state", "game-design-review"], constraint: ["퍼즐 세션", "첫 선택을 좁힙니다."], criterion: ["오프라인 결과", "authority를 비교합니다."], decision: ["복귀 cue", "telemetry로 검증합니다."], branches: [["복귀 보상 수령", "중단 부담 완화"], ["오프라인 결과 거부", "authority 확인"]], validation: "offline authority prototype와 return telemetry" },
  "st-g03": { kind: "concept", specialist: "design-game-systems", outputs: ["system-specification", "character-skill-combat-monster", "production-scope-risk"], constraint: ["역할과 자원", "협동 긴장을 정의합니다."], criterion: ["이탈 예외", "재합류 조건을 비교합니다."], decision: ["그룹 관찰", "동기화 가설을 검증합니다."], branches: [["동료 구조", "자원 비용 비교"], ["안전 탈출", "재합류 조건 확인"]], validation: "co-op rejoin prototype와 이탈 telemetry" },
  "st-g04": { kind: "concept", specialist: "design-game-systems", outputs: ["character-skill-combat-monster", "system-specification", "ui-ux-flow-state"], constraint: ["교전 목표", "경쟁 목적을 정합니다."], criterion: ["telegraph", "가독성 기준을 둡니다."], decision: ["match 검증", "안전과 fairness를 봅니다."], branches: [["공격 확정", "counterplay 확인"], ["회피·차단", "telegraph 확인"]], validation: "combat readability prototype와 fairness telemetry" },
  "st-g05": { kind: "concept", specialist: "design-game-content", outputs: ["core-motivation-loop", "character-skill-combat-monster", "production-scope-risk"], constraint: ["run 목표", "반복 목표를 정합니다."], criterion: ["실패 원인", "telegraph miss를 기록합니다."], decision: ["메타 성장", "scope 근거를 검토합니다."], branches: [["위험 경로", "보상 가설 검증"], ["안전 보상", "run 범위 보호"]], validation: "run failure prototype와 scope evidence" },
  "st-g06": { kind: "concept", specialist: "design-game-content", outputs: ["narrative-quest-npc", "system-specification", "rule-exception-matrix"], constraint: ["선택 장면", "의도를 명시합니다."], criterion: ["모순 확인", "분기 충돌을 비교합니다."], decision: ["제작 결정", "rights와 범위를 검토합니다."], branches: [["관계 유지", "state delta 기록"], ["관계 단절", "분기 비용 검토"]], validation: "branch conflict review와 rights evidence" },
  "st-g07": { kind: "concept", specialist: "design-player-experience", outputs: ["ui-ux-flow-state", "narrative-quest-npc", "accessibility-platform-matrix"], constraint: ["생활 행동", "자율 목표를 정합니다."], criterion: ["감각 대안", "접근 경로를 둡니다."], decision: ["usability 검증", "관찰로 수정합니다."], branches: [["시간 제한", "압박을 관찰"], ["자율 일정", "감각 대안 확인"]], validation: "usability observation과 accessibility feedback" },
  "st-g08": { kind: "concept", specialist: "design-game-economy-and-liveops", outputs: ["economy-balance", "system-specification", "ui-ux-flow-state"], constraint: ["자원 권위", "source를 정합니다."], criterion: ["guardrail 판단", "cascade를 제한합니다."], decision: ["simulation", "rollback을 검토합니다."], branches: [["증설 투자", "연쇄 효과 검증"], ["자원 보존", "rollback 조건 확인"]], validation: "resource simulation과 cascade rollback" },
  "st-g09": { kind: "concept", specialist: "design-game-content", outputs: ["narrative-quest-npc", "system-specification", "game-design-review"], constraint: ["창작 상태", "UGC source를 정합니다."], criterion: ["권리와 신고", "appeal을 연결합니다."], decision: ["안전 검토", "ethics owner가 봅니다."], branches: [["공개 게시", "권리 source 확인"], ["검토 대기", "moderation 확인"]], validation: "rights appeal review와 safety evidence" },
  "st-g10": { kind: "concept", specialist: "design-player-experience", outputs: ["game-design-brief", "ui-ux-flow-state", "accessibility-platform-matrix"], constraint: ["학습 맥락", "대상 요구를 확인합니다."], criterion: ["대체 활동", "접근 대안을 둡니다."], decision: ["당사자 검토", "효과 근거를 확인합니다."], branches: [["참여 지속", "동의 상태 확인"], ["대체 활동", "접근 대안 제공"]], validation: "participant feedback과 accessibility evidence" },
  "st-s01": { kind: "skill", skill: "apply-document-quality-profile", trigger: ["품질 trigger", "profile 요청을 받습니다."], requiredInput: "canonical-artifact + quality profile", outputs: ["selection-record", "quality-checklist", "requirement-manifest"], nextRoutes: ["define-game-vision", "design-game-systems", "design-game-content", "design-player-experience", "design-game-economy-and-liveops", "plan-game-production", "review-game-design", "visualize-game-design", "export-game-design-documents"], nextCondition: null, routeIds: [] },
  "st-s02": { kind: "skill", skill: "define-game-vision", trigger: ["경험 목표", "경험 목표를 받습니다."], requiredInput: "플레이어에게 약속할 경험 + 설계 제약", outputs: ["vision-pillars", "core-motivation-loop"], nextRoutes: ["design-game-systems"], nextCondition: null, routeIds: ["vision"] },
  "st-s03": { kind: "skill", skill: "design-game-content", trigger: ["콘텐츠 trigger", "퀘스트 의도를 받습니다."], requiredInput: "quest intent + rights boundary", outputs: ["narrative-quest-npc", "character-skill-combat-monster"], nextRoutes: ["review-game-design"], nextCondition: null, routeIds: ["content"] },
  "st-s04": { kind: "skill", skill: "design-game-economy-and-liveops", trigger: ["경제 trigger", "성장 질문을 받습니다."], requiredInput: "economy question + telemetry guardrail", outputs: ["economy-balance", "liveops-experiment-event"], nextRoutes: ["review-game-design"], nextCondition: null, routeIds: ["economy", "liveops"] },
  "st-s05": { kind: "skill", skill: "design-game-systems", trigger: ["시스템 trigger", "기능 질문을 받습니다."], requiredInput: "rule question + authoritative state", outputs: ["system-specification", "rule-exception-matrix", "data-schema-table-contract"], nextRoutes: ["review-game-design"], nextCondition: null, routeIds: ["systems"] },
  "st-s06": { kind: "skill", skill: "design-player-experience", trigger: ["UX trigger", "사용 흐름을 받습니다."], requiredInput: "user flow + accessibility constraint", outputs: ["ui-ux-flow-state", "accessibility-platform-matrix"], nextRoutes: ["review-game-design"], nextCondition: null, routeIds: ["player-experience"] },
  "st-s07": { kind: "skill", skill: "export-game-design-documents", trigger: ["출력 trigger", "format 요청을 받습니다."], requiredInput: "canonical-artifact + requested formats", outputs: ["export-preparation-manifest", "format-jobs"], nextRoutes: [], nextCondition: "pending format job → downstream renderer QA", routeIds: ["export"] },
  "st-s08": { kind: "skill", skill: "generate-image-assets", trigger: ["생성 trigger", "receipt를 확인합니다."], requiredInput: "selection receipt + approved prompt", outputs: ["image-generation-result", "image-generation-provenance"], nextRoutes: ["review-image-assets"], nextCondition: null, routeIds: [] },
  "st-s09": { kind: "skill", skill: "orchestrate-game-design-project", trigger: ["복합 trigger", "여러 domain을 받습니다."], requiredInput: "canonical-artifact + domain route requests", outputs: ["game-design-brief", "canonical-artifact"], nextRoutes: ["define-game-vision", "design-game-systems", "design-game-content", "design-player-experience", "design-game-economy-and-liveops", "plan-game-production", "review-game-design", "visualize-game-design", "export-game-design-documents"], nextCondition: null, routeIds: ["project-orchestration"] },
  "st-s10": { kind: "skill", skill: "plan-game-production", trigger: ["제작 trigger", "slice 요청을 받습니다."], requiredInput: "vertical slice + scope constraints", outputs: ["production-scope-risk", "decision-change-log"], nextRoutes: ["review-game-design"], nextCondition: null, routeIds: ["production"] },
  "st-s11": { kind: "skill", skill: "plan-image-assets", trigger: ["계획 trigger", "asset 필요를 받습니다."], requiredInput: "asset need + rights constraint", outputs: ["image-assets-manifest", "image-prompts"], nextRoutes: ["generate-image-assets", "visualize-game-design"], nextCondition: null, routeIds: [] },
  "st-s12": { kind: "skill", skill: "review-game-design", trigger: ["검토 trigger", "review 질문을 받습니다."], requiredInput: "canonical-artifact + review question", outputs: ["game-design-review", "decision-change-log"], nextRoutes: ["review-game-design", "visualize-game-design", "export-game-design-documents"], nextCondition: null, routeIds: ["review"] },
  "st-s13": { kind: "skill", skill: "review-image-assets", trigger: ["검토 trigger", "draft receipt를 받습니다."], requiredInput: "draft receipt + lifecycle state", outputs: ["image-asset-review", "lifecycle-receipt"], nextRoutes: ["export-game-design-documents"], nextCondition: null, routeIds: [] },
  "st-s14": { kind: "skill", skill: "svg-infographic", trigger: ["SVG trigger", "구조 관계를 받습니다."], requiredInput: "relationship structure + evidence", outputs: ["editable-svg", "png-2x", "render-evidence"], nextRoutes: ["visualize-game-design"], nextCondition: null, routeIds: [] },
  "st-s15": { kind: "skill", skill: "visualize-game-design", trigger: ["시각화 trigger", "관계 질문을 받습니다."], requiredInput: "relationship question + source data", outputs: ["editable-svg", "png-2x", "visualization-evidence"], nextRoutes: ["review-game-design", "export-game-design-documents"], nextCondition: null, routeIds: ["visualization"] },
  "st-s16": { kind: "skill", skill: "design-cutscene-visual-preproduction", trigger: ["style-master", "스타일 기준 이미지"], requiredInput: "cutscene brief + game-state return", outputs: ["cutscene-brief", "cutscene-shot-package", "cutscene-prompt-package", "cutscene-cost-estimate", "cutscene-continuity-review"], nextRoutes: ["plan-image-assets", "generate-image-assets", "review-image-assets"], nextCondition: "current estimate + named live approval → wave dispatch", routeIds: ["cutscene-visual-preproduction"] },
});

export const STUDIO_CANONICAL_ROUTE_ARRAY_POLICY = "ordered-exact";

export const STUDIO_CANONICAL_ROUTE_PRODUCTION_CONTRACT = Object.freeze({
  "project-orchestration": { triggerIntents: ["multi-discipline project", "game design brief", "scope planning", "project roadmap", "milestone planning", "ambiguous design request"], skill: "orchestrate-game-design-project", requiredInputs: ["target player", "target experience", "platform", "genre", "development stage", "constraints", "completion criteria"], artifactType: "game-design-brief" },
  vision: { triggerIntents: ["game vision", "design pillars", "core fun", "motivation loop"], skill: "define-game-vision", requiredInputs: ["target player", "desired emotion", "experience intent", "constraints"], artifactType: "vision-pillars" },
  systems: { triggerIntents: ["game system", "rules", "state transitions", "data schema"], skill: "design-game-systems", requiredInputs: ["system purpose", "inputs", "constraints", "failure expectations"], artifactType: "system-specification" },
  content: { triggerIntents: ["quest", "level content", "narrative", "character", "enemy", "combat", "boss", "encounter", "puzzle", "level design", "soft lock", "secret route", "reset", "retry"], skill: "design-game-content", requiredInputs: ["content purpose", "supporting systems", "production budget", "repeatability target"], artifactType: "narrative-quest-npc" },
  "cutscene-visual-preproduction": { triggerIntents: ["컷씬 기획", "스토리보드", "시네마틱 이미지", "마스터 이미지", "컷씬 프롬프트", "컷씬 승인 후 생성"], skill: "design-cutscene-visual-preproduction", requiredInputs: ["cutscene brief", "game-state return"], artifactType: "cutscene-visual-preproduction" },
  "player-experience": { triggerIntents: ["player experience", "UX flow", "tutorial", "accessibility", "input"], skill: "design-player-experience", requiredInputs: ["critical actions", "platform", "input methods", "first-session goal"], artifactType: "ui-ux-flow-state" },
  economy: { triggerIntents: ["game economy", "monetization", "currency balance", "shop balance"], skill: "design-game-economy-and-liveops", requiredInputs: ["business model", "currencies", "progression target", "target inventory", "real-price policy"], artifactType: "economy-balance" },
  liveops: { triggerIntents: ["LiveOps", "event plan", "experiment", "segment rollout"], skill: "design-game-economy-and-liveops", requiredInputs: ["event goal", "experiment hypothesis", "control", "sample and duration", "protection metrics"], artifactType: "liveops-experiment-event" },
  production: { triggerIntents: ["production plan", "scope", "milestone", "prototype", "risk"], skill: "plan-game-production", requiredInputs: ["target experience", "team", "schedule", "technology", "dependencies"], artifactType: "production-scope-risk" },
  review: { triggerIntents: ["design review", "critique", "launch readiness", "risk review"], skill: "review-game-design", requiredInputs: ["canonical artifact", "review questions", "decision owner"], artifactType: "game-design-review" },
  visualization: { triggerIntents: ["diagram", "visualize", "flow chart", "economy map", "roadmap diagram"], skill: "visualize-game-design", requiredInputs: ["valid canonical artifact", "relationship to clarify", "target audience"], artifactType: "canonical-artifact" },
  export: { triggerIntents: ["export", "PDF", "DOCX", "presentation", "PPTX"], skill: "export-game-design-documents", requiredInputs: ["valid canonical artifact", "requested formats", "audience", "purpose"], artifactType: "canonical-artifact" },
  "reference-game-analysis": { triggerIntents: ["reference game analysis", "game comparison", "design transfer decision", "경쟁작 분석", "레퍼런스 게임 분석", "장르 시스템 인벤토리", "게임 시스템 비교", "증거와 추정 분리"], skill: "analyze-game-design-references", requiredInputs: ["reference brief", "reference set", "evidence scope", "project constraints"], artifactType: "reference-system-analysis" },
  "project-glossary-maintenance": { triggerIntents: ["game design glossary", "terminology maintenance", "terminology findings", "게임 기획 용어 사전", "용어 후보", "용어 승인", "한국어 영어 용어 일관성"], skill: "maintain-game-design-glossary", requiredInputs: ["glossary candidates", "glossary snapshot", "human decision owner"], artifactType: "game-design-glossary" },
});

function indexUniqueById(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array`);
  const byId = new Map();
  for (const value of values) {
    if (byId.has(value?.id)) throw new TypeError(`duplicate ${label} ID: ${value?.id}`);
    byId.set(value?.id, value);
  }
  return byId;
}

function assertExactIds(actualIds, expectedIds, label) {
  const missing = expectedIds.filter((id) => !actualIds.has(id));
  const extra = [...actualIds.keys()].filter((id) => !expectedIds.includes(id));
  if (missing.length > 0 || extra.length > 0) {
    throw new TypeError(`${label} mismatch: missing [${missing.join(", ")}], extra [${extra.join(", ")}]`);
  }
}

export function validateStudioDiagramProductionBatch(sources, routing) {
  if (!Array.isArray(sources)) throw new TypeError("use-case diagram sources must be an array");
  const studioSources = sources.filter(({ scope }) => scope === "game-design-studio-use-case" || scope === "game-design-studio-skill");
  const sourceById = indexUniqueById(studioSources, "Studio production source");
  const expectedSourceIds = Object.keys(STUDIO_DIAGRAM_PRODUCTION_CONTRACT);
  assertExactIds(sourceById, expectedSourceIds, "Studio production source IDs");

  const routeById = indexUniqueById(routing?.routes, "canonical route");
  const expectedRouteIds = Object.keys(STUDIO_CANONICAL_ROUTE_PRODUCTION_CONTRACT);
  assertExactIds(routeById, expectedRouteIds, "canonical route IDs");
  if (!Array.isArray(routing?.skillIds)) throw new TypeError("Studio routing skillIds must be an array");
  const installedSkillIds = new Set(routing.skillIds);

  for (const [sourceId, expected] of Object.entries(STUDIO_DIAGRAM_PRODUCTION_CONTRACT)) {
    if (expected.kind !== "skill") continue;
    const source = sourceById.get(sourceId);
    for (const routeId of expected.routeIds) {
      const target = routeById.get(routeId).skill;
      if (target !== source.semantic.skill) {
        throw new TypeError(`${sourceId} routeIds mismatch: ${routeId} targets ${target}, not ${source.semantic.skill}`);
      }
    }
    for (const target of source.semantic.next_routes) {
      if (!installedSkillIds.has(target)) {
        throw new TypeError(`${sourceId} nextRoutes target ${target} is absent from installed skillIds`);
      }
    }
  }

  for (const [routeId, expected] of Object.entries(STUDIO_CANONICAL_ROUTE_PRODUCTION_CONTRACT)) {
    const route = routeById.get(routeId);
    assertCanonicalRouteValue(routeId, "triggerIntents", route.triggerIntents, expected.triggerIntents);
    assertCanonicalRouteValue(routeId, "skill", route.skill, expected.skill);
    assertCanonicalRouteValue(routeId, "requiredInputs", route.requiredInputs, expected.requiredInputs);
    assertCanonicalRouteValue(routeId, "artifactType", route.artifactType, expected.artifactType);
    if (!installedSkillIds.has(route.skill)) throw new TypeError(`${routeId} canonical route target ${route.skill} is absent from installed skillIds`);
  }

  for (const source of studioSources) validateStudioDiagramProductionContract(source);
}


export function validateStudioDiagramProductionContract(source) {
  const expected = STUDIO_DIAGRAM_PRODUCTION_CONTRACT[source.id];
  if (!expected) {
    throw new TypeError(`${source.id} is missing a Studio production diagram contract`);
  }
  if (expected.kind === "competency") {
    assertProductionValue(source, "specialist", source.semantic.specialist, expected.specialist);
    assertProductionValue(source, "outputs", source.semantic.outputs, expected.outputs);
    assertProductionValue(source, "review", source.semantic.review, expected.review);
    return;
  }
  if (expected.kind === "concept") {
    assertProductionValue(source, "specialist", source.semantic.specialist, expected.specialist);
    assertProductionValue(source, "outputs", source.semantic.outputs, expected.outputs);
    assertProductionValue(source, "constraint", [source.steps[0].label, source.steps[0].detail], expected.constraint);
    assertProductionValue(source, "criterion", [source.steps[2].label, source.steps[2].detail], expected.criterion);
    assertProductionValue(source, "decision", [source.steps[3].label, source.steps[3].detail], expected.decision);
    assertProductionValue(source, "branches", source.branches.map(({ label, detail }) => [label, detail]), expected.branches);
    assertProductionValue(source, "validation", source.semantic.validation, expected.validation);
    return;
  }
  assertProductionValue(source, "skill", source.semantic.skill, expected.skill);
  assertProductionValue(source, "trigger", [source.steps[0].label, source.steps[0].detail], expected.trigger);
  assertProductionValue(source, "required_input", source.semantic.required_input, expected.requiredInput);
  assertProductionValue(source, "outputs", source.semantic.outputs, expected.outputs);
  assertProductionValue(source, "next_routes", source.semantic.next_routes, expected.nextRoutes);
  assertProductionValue(source, "next_condition", source.semantic.next_condition ?? null, expected.nextCondition);
}
