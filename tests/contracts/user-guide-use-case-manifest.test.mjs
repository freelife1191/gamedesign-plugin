import assert from "node:assert/strict";
import { lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  isCompletePng,
  parseViewBox,
  pngDims,
} from "../../shared/vendor/skillstead/svg-infographic/0.8.3/scripts/render.mjs";
import { loadUseCaseManifest, validateUseCaseGuides } from "../../tooling/lib/use-case-guides.mjs";
import { collectHeadingAnchors, collectProductInventory } from "../../tooling/lib/user-guides.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const FAQ_ANSWER_FIELDS = [
  "결론",
  "이유와 경계",
  "지금 실행할 요청문",
  "예상 결과물",
  "관련 가이드",
  "권리·근거·승인",
];
const AUDIENCE_SECTION_HEADINGS = [
  "현재 상황과 성공 신호",
  "권장 경로와 사례",
  "실행 요청",
  "결과와 검토·재개 경계",
];
const STUDIO_COMPETENCY_CASE_MARKERS = [
  "현재 상황과 목표",
  "적합한 경우와 적합하지 않은 경우",
  "준비 입력",
  "10분 미니 실습",
  "표준 실습",
  "포트폴리오·실무 확장",
  "Codex App 요청문",
  "Codex CLI 요청문",
  "스킬·템플릿 흐름",
  "결과물",
  "검토와 승인",
  "실패·재개",
  "자기점검과 다음 학습",
];
const STUDIO_COMPETENCY_HEADINGS = Object.freeze({
  "ST-C01": "ST-C01 플레이어 경험과 게임 비전",
  "ST-C02": "ST-C02 행동·핵심 루프·의미 있는 선택",
  "ST-C03": "ST-C03 규칙·상태·예외·데이터",
  "ST-C04": "ST-C04 UI·UX·온보딩·접근성",
  "ST-C05": "ST-C05 콘텐츠·내러티브·퀘스트·NPC",
  "ST-C06": "ST-C06 캐릭터·스킬·전투·몬스터",
  "ST-C07": "ST-C07 성장·경제·밸런스·LiveOps",
  "ST-C08": "ST-C08 제작·검토·이미지·출력",
});
const STUDIO_CONCEPT_HEADINGS = Object.freeze({
  "ST-G01": "ST-G01 모바일 수집형 RPG·라이브서비스",
  "ST-G02": "ST-G02 캐주얼 퍼즐·방치형",
  "ST-G03": "ST-G03 협동 생존 액션",
  "ST-G04": "ST-G04 경쟁 PvP 아레나",
  "ST-G05": "ST-G05 PC·콘솔 액션 로그라이트",
  "ST-G06": "ST-G06 선택형 내러티브 어드벤처",
  "ST-G07": "ST-G07 코지 생활 시뮬레이션",
  "ST-G08": "ST-G08 경영·타이쿤 시뮬레이션",
  "ST-G09": "ST-G09 샌드박스·UGC",
  "ST-G10": "ST-G10 교육·사회문제·접근성 중심 게임",
});
const STUDIO_CONCEPT_FIELDS = Object.freeze([
  "플레이어 맥락",
  "설계 제약",
  "전이 가능한 역량",
  "지원되지 않는 가정",
  "검증 계획",
]);
const STUDIO_CONCEPT_CLI_SKILLS = Object.freeze({
  "ST-G01": "design-game-economy-and-liveops",
  "ST-G02": "design-game-systems",
  "ST-G03": "design-game-systems",
  "ST-G04": "design-game-systems",
  "ST-G05": "design-game-content",
  "ST-G06": "design-game-content",
  "ST-G07": "design-player-experience",
  "ST-G08": "design-game-economy-and-liveops",
  "ST-G09": "design-game-content",
  "ST-G10": "design-player-experience",
});
const STUDIO_CONCEPT_SEMANTIC_CONTRACT = Object.freeze({
  "ST-G01": {
    "플레이어 맥락": ["모바일", "짧거나 중단되는 세션"],
    "설계 제약": ["수집", "LiveOps", "경제"],
    "전이 가능한 역량": ["ST-C02", "ST-C07"],
    "지원되지 않는 가정": ["retention", "KPI", "가정"],
    "검증 계획": ["prototype", "telemetry"],
  },
  "ST-G02": {
    "플레이어 맥락": ["퍼즐", "복귀"],
    "설계 제약": ["방치", "오프라인", "정보 부하"],
    "전이 가능한 역량": ["ST-C02", "ST-C04"],
    "지원되지 않는 가정": ["재미", "가정"],
    "검증 계획": ["prototype", "telemetry"],
  },
  "ST-G03": {
    "플레이어 맥락": ["협동", "역할"],
    "설계 제약": ["자원", "실패", "복구"],
    "전이 가능한 역량": ["ST-C03", "ST-C06"],
    "지원되지 않는 가정": ["완주율", "가정"],
    "검증 계획": ["그룹 플레이테스트", "관찰"],
  },
  "ST-G04": {
    "플레이어 맥락": ["PvP", "숙련도"],
    "설계 제약": ["counterplay", "가독성", "사회적 위험"],
    "전이 가능한 역량": ["ST-C04", "ST-C06"],
    "지원되지 않는 가정": ["승률", "공정", "가정"],
    "검증 계획": ["prototype", "match telemetry"],
  },
  "ST-G05": {
    "플레이어 맥락": ["PC·콘솔", "run"],
    "설계 제약": ["로그라이트", "메타 성장", "입력 장치"],
    "전이 가능한 역량": ["ST-C02", "ST-C06", "ST-C08"],
    "지원되지 않는 가정": ["난이도", "가정"],
    "검증 계획": ["prototype", "실패 지점"],
  },
  "ST-G06": {
    "플레이어 맥락": ["선택", "분기"],
    "설계 제약": ["상태", "consequence", "콘텐츠 범위"],
    "전이 가능한 역량": ["ST-C03", "ST-C05"],
    "지원되지 않는 가정": ["몰입", "가정"],
    "검증 계획": ["분기 추적", "플레이테스트"],
  },
  "ST-G07": {
    "플레이어 맥락": ["코지", "자율"],
    "설계 제약": ["생활", "압박", "접근성"],
    "전이 가능한 역량": ["ST-C04", "ST-C05"],
    "지원되지 않는 가정": ["편안", "가정"],
    "검증 계획": ["usability", "sensory alternative"],
  },
  "ST-G08": {
    "플레이어 맥락": ["경영", "의사결정"],
    "설계 제약": ["경제", "피드백", "연쇄"],
    "전이 가능한 역량": ["ST-C03", "ST-C07"],
    "지원되지 않는 가정": ["최적", "수익", "가정"],
    "검증 계획": ["simulation", "telemetry"],
  },
  "ST-G09": {
    "플레이어 맥락": ["창작자", "발견"],
    "설계 제약": ["UGC", "moderation", "rights", "accessibility", "ethical review"],
    "전이 가능한 역량": ["ST-C03", "ST-C04", "ST-C05"],
    "지원되지 않는 가정": ["안전", "가정"],
    "검증 계획": ["moderation", "권리", "접근성", "윤리"],
  },
  "ST-G10": {
    "플레이어 맥락": ["학습자", "사회문제", "접근 요구"],
    "설계 제약": ["moderation", "rights", "accessibility", "ethical review"],
    "전이 가능한 역량": ["ST-C01", "ST-C04", "ST-C05"],
    "지원되지 않는 가정": ["학습 효과", "사회적 효과", "가정"],
    "검증 계획": ["동의", "접근성", "윤리", "사람 검토"],
  },
});
const STUDIO_CONCEPT_LATE_HEADINGS = Object.freeze([
  "포트폴리오·실무 확장",
  "결과물",
  "검토와 승인",
  "실패·재개",
  "자기점검과 다음 학습",
]);
const STUDIO_CONCEPT_LATE_SEMANTIC_CONTRACT = Object.freeze({
  "ST-G01": {
    "포트폴리오·실무 확장": ["수집 동기", "telemetry 정의", "사람의 결정"],
    "결과물": ["EXP-COLLECT-01", "이벤트 교환 규칙", "보호 기준 위반"],
    "검토와 승인": ["design·economy·policy owner", "telemetry 동의", "rollback"],
    "실패·재개": ["지표 정의", "`blocked`", "승인된 telemetry 정의"],
    "자기점검과 다음 학습": ["수집·성장·이벤트", "rollback", "`ST-C07`"],
  },
  "ST-G02": {
    "포트폴리오·실무 확장": ["중단·복귀 상태", "정보 부하", "수정 결정"],
    "결과물": ["STATE-RETURN-02", "offline result", "recovery"],
    "검토와 승인": ["design·UX·accessibility owner", "오프라인 규칙", "복귀 cue"],
    "실패·재개": ["오프라인 시간의 authority", "state ID", "오프라인 authority 결정"],
    "자기점검과 다음 학습": ["예측 가능한 복구", "보상 수령", "`ST-C04`"],
  },
  "ST-G03": {
    "포트폴리오·실무 확장": ["자원 충돌", "이탈 예외", "그룹 관찰"],
    "결과물": ["RULE-REVIVE-03", "downed", "disconnect recovery"],
    "검토와 승인": ["design·engineering·player-safety owner", "authority", "기록 동의"],
    "실패·재개": ["동기화 authority", "`blocked`", "재합류 authority 결정"],
    "자기점검과 다음 학습": ["의미 있는 선택", "동시성·이탈 예외", "`ST-C06`"],
  },
  "ST-G04": {
    "포트폴리오·실무 확장": ["counterplay", "telegraph", "공정성 해석"],
    "결과물": ["ATK-ARENA-04", "counterplay", "prototype pending"],
    "검토와 승인": ["combat·UX·accessibility·player-safety owner", "데이터 해석", "보호 정책"],
    "실패·재개": ["대응 없는 공격", "release 판단", "ATK-ARENA-04"],
    "자기점검과 다음 학습": ["승률", "신고·차단·이탈", "`ST-C04`"],
  },
  "ST-G05": {
    "포트폴리오·실무 확장": ["선택 지도", "실패 원인 관찰", "scope 결정"],
    "결과물": ["RUN-05", "telegraph miss assumption", "test: pending"],
    "검토와 승인": ["design·combat·production·accessibility owner", "입력 대응", "콘텐츠 범위"],
    "실패·재개": ["실패 원인", "제작 근거", "RUN-05 관찰"],
    "자기점검과 다음 학습": ["무작위성", "입력 장치별 가독성", "`ST-C08`"],
  },
  "ST-G06": {
    "포트폴리오·실무 확장": ["플레이어 해석", "상태 모순", "제작 결정"],
    "결과물": ["CHOICE-RIVER-06", "state delta", "evidence: pending"],
    "검토와 승인": ["narrative·system·production·rights owner", "민감성·권리", "제작 범위"],
    "실패·재개": ["state source", "`blocked`", "CHOICE-RIVER-06"],
    "자기점검과 다음 학습": ["state", "재합류", "`ST-C05`"],
  },
  "ST-G07": {
    "포트폴리오·실무 확장": ["usability evidence", "접근성 장벽", "수정 결정"],
    "결과물": ["ACT-GARDEN-07", "missed event", "sensory alternative"],
    "검토와 승인": ["design·content·accessibility owner", "시간 압력", "관계 표현"],
    "실패·재개": ["critical action", "`pending`", "ACT-GARDEN-07"],
    "자기점검과 다음 학습": ["자율성", "입력·감각 대안", "`ST-C04`"],
  },
  "ST-G08": {
    "포트폴리오·실무 확장": ["잘못된 가설", "simulation", "rollback 결정"],
    "결과물": ["RES-POWER-08", "cascade guardrail", "simulation: pending"],
    "검토와 승인": ["economy·system·UX owner", "정보 계층", "rollback"],
    "실패·재개": ["resource authority", "telemetry", "RES-POWER-08"],
    "자기점검과 다음 학습": ["결과 원인", "연쇄 실패", "`ST-C07`"],
  },
  "ST-G09": {
    "포트폴리오·실무 확장": ["상태·권리 계약", "위해 시나리오", "접근성 개선"],
    "결과물": ["UGC-STATE-09", "rights source", "owner: pending"],
    "검토와 승인": ["moderation·rights·accessibility·ethics owner", "appeal", "자동 승인하지 않습니다"],
    "실패·재개": ["권리 source", "`blocked`", "UGC-STATE-09"],
    "자기점검과 다음 학습": ["moderation·rights·accessibility·ethical review", "PII", "`ST-C05`"],
  },
  "ST-G10": {
    "포트폴리오·실무 확장": ["당사자·전문가 피드백", "철회·대체 경로", "접근성 개선"],
    "결과물": ["ACT-CONSENT-10", "exit: always available", "effect claim: pending evidence"],
    "검토와 승인": ["대상 당사자", "rights·accessibility·ethics owner", "평가와 공개 범위"],
    "실패·재개": ["동의·철회", "`blocked`", "ACT-CONSENT-10"],
    "자기점검과 다음 학습": ["검증되지 않은 효과", "대체 활동", "`ST-C01`"],
  },
});
const STUDIO_COMPETENCY_LINK_TARGETS = Object.freeze({
  "ST-C01": "competency-paths.md#st-c01-플레이어-경험과-게임-비전",
  "ST-C02": "competency-paths.md#st-c02-행동핵심-루프의미-있는-선택",
  "ST-C03": "competency-paths.md#st-c03-규칙상태예외데이터",
  "ST-C04": "competency-paths.md#st-c04-uiux온보딩접근성",
  "ST-C05": "competency-paths.md#st-c05-콘텐츠내러티브퀘스트npc",
  "ST-C06": "competency-paths.md#st-c06-캐릭터스킬전투몬스터",
  "ST-C07": "competency-paths.md#st-c07-성장경제밸런스liveops",
  "ST-C08": "competency-paths.md#st-c08-제작검토이미지출력",
});
const STUDIO_CONCEPT_COMPARISON_CONTRACT = Object.freeze({
  "ST-G01": {
    "핵심 루프": ["수집", "편성", "전투", "성장"],
    "실패·복구": ["재편성", "자원 보호", "rollback"],
    "정보 부하": ["편성", "경제", "이벤트"],
    "사회적 위험": ["결제 압력", "비교 경쟁"],
    "콘텐츠 주기": ["한 변수", "stop 조건"],
    "필요한 근거": ["조합 관찰", "source·sink telemetry"],
    competencies: ["ST-C02", "ST-C07"],
  },
  "ST-G02": {
    "핵심 루프": ["퍼즐", "방치", "복귀"],
    "실패·복구": ["중단 저장", "오프라인 결과 거부"],
    "정보 부하": ["첫 세션", "복귀 cue"],
    "사회적 위험": ["강제 알림", "놓침 압력"],
    "콘텐츠 주기": ["퍼즐 변형", "복귀 상태"],
    "필요한 근거": ["퍼즐 prototype", "중단·복귀 telemetry"],
    competencies: ["ST-C02", "ST-C04"],
  },
  "ST-G03": {
    "핵심 루프": ["탐색", "채집", "방어", "탈출"],
    "실패·복구": ["쓰러짐", "이탈", "재합류"],
    "정보 부하": ["역할", "자원", "위험 cue"],
    "사회적 위험": ["독점", "배제", "괴롭힘"],
    "콘텐츠 주기": ["encounter", "역할 변형"],
    "필요한 근거": ["그룹 관찰", "동기화 test case"],
    competencies: ["ST-C03", "ST-C06"],
  },
  "ST-G04": {
    "핵심 루프": ["목표 경쟁", "교전", "판정"],
    "실패·복구": ["패배 설명", "이탈 보호"],
    "정보 부하": ["telegraph", "전장 우선순위"],
    "사회적 위험": ["독성 행동", "신고", "차단"],
    "콘텐츠 주기": ["roster", "버전 관리"],
    "필요한 근거": ["숙련도별 관찰", "match telemetry"],
    competencies: ["ST-C04", "ST-C06"],
  },
  "ST-G05": {
    "핵심 루프": ["run 진입", "빌드", "위험", "재시도"],
    "실패·복구": ["사망 원인", "다음 선택"],
    "정보 부하": ["전투 cue", "reward 선택"],
    "사회적 위험": ["실패 낙인", "접근 장벽"],
    "콘텐츠 주기": ["encounter", "reward pool 범위"],
    "필요한 근거": ["vertical slice", "입력별 실패 관찰"],
    competencies: ["ST-C02", "ST-C08"],
  },
  "ST-G06": {
    "핵심 루프": ["장면", "선택", "상태", "결과"],
    "실패·복구": ["저장", "재합류", "모순 복구"],
    "정보 부하": ["선택 문구", "consequence"],
    "사회적 위험": ["민감 표현", "권리 침해"],
    "콘텐츠 주기": ["분기 unit", "재사용 범위"],
    "필요한 근거": ["state simulation", "해석 플레이테스트"],
    competencies: ["ST-C03", "ST-C05"],
  },
  "ST-G07": {
    "핵심 루프": ["돌보기", "만들기", "교류", "변화"],
    "실패·복구": ["놓침", "중단", "일정 복구"],
    "정보 부하": ["생활 cue", "감각 대안"],
    "사회적 위험": ["guilt", "강제 접속", "고정관념"],
    "콘텐츠 주기": ["반복 루틴", "선택 이벤트"],
    "필요한 근거": ["접근 요구별 usability evidence"],
    competencies: ["ST-C04", "ST-C05"],
  },
  "ST-G08": {
    "핵심 루프": ["관찰", "투자", "운영", "피드백"],
    "실패·복구": ["debt", "연쇄 실패", "rollback"],
    "정보 부하": ["원인", "예상", "결과"],
    "사회적 위험": ["조작적 경제 표현"],
    "콘텐츠 주기": ["tick·event 규칙", "scenario"],
    "필요한 근거": ["economy simulation", "선택 telemetry"],
    competencies: ["ST-C03", "ST-C07"],
  },
  "ST-G09": {
    "핵심 루프": ["제작", "검사", "게시", "발견"],
    "실패·복구": ["차단", "삭제", "appeal"],
    "정보 부하": ["도구", "검토", "신고 상태"],
    "사회적 위험": ["위해", "권리", "moderation"],
    "콘텐츠 주기": ["creator unit", "review queue"],
    "필요한 근거": ["권리 source", "접근성·윤리 검토"],
    competencies: ["ST-C03", "ST-C05"],
  },
  "ST-G10": {
    "핵심 루프": ["동의", "참여", "reflection", "대체"],
    "실패·복구": ["철회", "도움", "안전한 중단"],
    "정보 부하": ["목적", "활동", "지원 정보"],
    "사회적 위험": ["대리 표현", "위해", "데이터 권리"],
    "콘텐츠 주기": ["학습 unit", "사람 검토 주기"],
    "필요한 근거": ["당사자·전문가·접근성·윤리 evidence"],
    competencies: ["ST-C01", "ST-C04"],
  },
});
const STUDIO_COMPETENCY_SEMANTIC_CONTRACT = Object.freeze({
  "ST-C01": [
    ["player promise", "anti-pillar"],
    ["시장 규모", "ST-C03"],
    ["decision owner", "플레이테스트"],
    ["시스템 반응", "prototype"],
    ["`vision-pillars`", "반례 과제"],
    ["포기한 기능", "회사 고유 문서"],
    ["prototype 검증 질문", "assumption"],
    ["artifact=game-design/island-restoration/vision-pillars", "실제 design owner"],
    ["`document-quality-editor`", "`production-feasibility-critic`"],
    ["P-01", "`game-design-review`"],
    ["실제 design owner", "자동 승인"],
    ["validation task", "P-01"],
    ["`ST-C02`", "Task 6"],
  ],
  "ST-C02": [
    ["player verb", "meaningful choice"],
    ["coercive loop", "ST-C07"],
    ["player promise", "player-protection"],
    ["탐색 → 선택 → 운반 → 복구 → 변화 확인", "meaningful choice"],
    ["`core-motivation-loop`", "선택 분포"],
    ["verb 후보", "시스템 rule ID"],
    ["강제 반복", "retention"],
    ["artifact=game-design/island-restoration/core-loop", "failure recovery"],
    ["`system-economy-designer`", "실제 design owner"],
    ["L-02", "`game-design-review`"],
    ["player-protection owner", "retention"],
    ["모든 분기가 같은 결과", "L-02"],
    ["`ST-C03`", "`ST-C04`"],
  ],
  "ST-C03": [
    ["authoritative state", "data schema"],
    ["구현·QA handoff", "database 구조"],
    ["system boundary", "실제 schema"],
    ["idle → validating → crafting → completed|failed|cancelled", "authority"],
    ["`rule-exception-matrix`", "migration·rollback"],
    ["executable test case", "schema"],
    ["공동 제작 작업대", "runtime schema"],
    ["artifact=game-design/shared-workbench/system-specification", "stable rule ID"],
    ["`system-economy-designer`", "engineering owner"],
    ["R-CRAFT-03", "TC-09"],
    ["system boundary", "engineering owner"],
    ["schema source", "R-CRAFT-03"],
    ["authoritative state", "`ST-C06`"],
  ],
  "ST-C04": [
    ["critical action", "accessibility"],
    ["첫 입력", "규정 준수"],
    ["critical actions", "usability 관찰"],
    ["non-pointer input", "정보 없이"],
    ["`accessibility-platform-matrix`", "sensory alternative"],
    ["critical action", "비식별화"],
    ["accessible alternative", "interruption"],
    ["artifact=game-design/first-session/ui-ux-flow-state", "accessibility-platform-matrix"],
    ["`ux-accessibility-reviewer`", "accessibility·design owner"],
    ["UX-ACT-01", "`game-design-review`"],
    ["platform matrix", "accessibility owner"],
    ["`pending`", "UX-ACT-01"],
    ["sensory alternative", "`ST-C05`"],
  ],
  "ST-C05": [
    ["침수된 기록 보관소", "production evidence"],
    ["AI·UGC", "회사 문체"],
    ["entry condition", "localization·accessibility"],
    ["choice-pending", "제작 불가능"],
    ["`narrative-quest-npc`", "rights·consent"],
    ["대사량", "NDA"],
    ["rights-consent", "침수 기록 보관소"],
    ["artifact=game-design/archive-quest/narrative-quest-npc", "stable content ID"],
    ["`content-narrative-designer`", "실제 content·rights·production owner"],
    ["Q-ARCH-01", "rights-consent"],
    ["연결되지 않은 system/data ID", "권리 담당자"],
    ["`blocked`", "SYS-WATER"],
    ["콘텐츠가 참조하는 system/data ID", "`ST-C06`"],
  ],
  "ST-C06": [
    ["훈련용 수호체", "counterplay"],
    ["전투 수치표", "prototype·telemetry"],
    ["entity IDs", "readability evidence"],
    ["wind-up", "cooldown 상태"],
    ["`character-skill-combat-monster`", "stop condition"],
    ["strategy 목표", "combat/data/accessibility owner"],
    ["돌진 skill rule", "provisional balance test"],
    ["artifact=game-design/training-guardian/character-skill-combat-monster", "readability blocker"],
    ["`system-economy-designer`", "실제 combat/design owner"],
    ["ATK-GUARD-02", "balance test"],
    ["대응 없는 공격", "combat owner"],
    ["canonical rule", "ATK-GUARD-02"],
    ["수치를 사실처럼", "`ST-C07`"],
  ],
  "ST-C07": [
    ["공동체 축제", "LiveOps"],
    ["실제 가격", "여러 변수를"],
    ["resource IDs", "tested rollback"],
    ["무한 축적", "한 변수"],
    ["`economy-balance`", "tested rollback"],
    ["보호 기준", "synthetic example"],
    ["공동체 축제 토큰", "telemetry"],
    ["artifact=game-design/community-festival/economy-balance", "rollback gate"],
    ["`liveops-data-designer`", "실제 economy·LiveOps·policy owner"],
    ["EXP-FEST-01", "guardrail"],
    ["다중 변수", "policy"],
    ["telemetry definition", "EXP-FEST-01"],
    ["명시적 stop", "`ST-C08`"],
  ],
  "ST-C08": [
    ["작은 탐험 prototype", "renderer-neutral export"],
    ["capacity 근거 없는 일정", "production-ready"],
    ["capacity evidence", "named-human decision receipt"],
    ["prototype / defer / exclude", "stable asset ID"],
    ["`prompt-only`", "OpenAI only"],
    ["NDA", "권리 불명 자산"],
    ["IMAGE_GEN_MODE=prompt-only", "renderer-neutral"],
    ["artifact=game-design/exploration-prototype/production-scope-risk", "export-game-design-documents"],
    ["`art-brief-director`", "release"],
    ["SCOPE-04", "derived formats unavailable"],
    ["rights/asset owner", "자동 승인"],
    ["stable asset ID", "unavailable인 PDF job"],
    ["provider routing", "결과물 카탈로그"],
  ],
});
const STUDIO_IMAGE_MODE_SCOPE_CONTRACT = Object.freeze({
  "prompt-only": "`prompt-only`는 외부 호출 없이 prompt/placeholder만",
  select: "`select`는 실제 사용자의 immutable receipt에 든 ordered stable IDs만",
  required: "`required`는 manifest의 finite required assets만",
  all: "`all`은 manifest에 선언된 required·recommended·variant만",
});
const OUTPUT_TABLE_HEADINGS = [
  "사용자 요청",
  "템플릿",
  "최소 파일 경로",
  "내용 범위",
  "선택 이미지·도식 자산",
  "파생 형식",
  "사람 검토",
  "포트폴리오·팀 활용",
];
const STUDIO_CASE_CONTRACT = Object.freeze([
  ["ST-C01", "competency", "st-c01-플레이어-경험과-게임-비전", ["AUD-01", "AUD-04", "AUD-05", "AUD-06"], ["foundation", "applied"], ["apply-document-quality-profile", "define-game-vision", "orchestrate-game-design-project", "review-game-design"], ["vision-pillars", "game-design-brief"], ["vision-pillars", "game-design-brief", "game-design-review"], "플레이어 경험과 게임 비전을 검증 가능한 기준으로 만드는 흐름"],
  ["ST-C02", "competency", "st-c02-행동핵심-루프의미-있는-선택", ["AUD-01", "AUD-04", "AUD-05"], ["foundation", "applied"], ["define-game-vision", "design-game-systems", "design-player-experience", "review-game-design"], ["core-motivation-loop", "system-specification"], ["core-motivation-loop", "system-specification", "game-design-review"], "플레이어 행동과 핵심 루프 및 의미 있는 선택의 흐름"],
  ["ST-C03", "competency", "st-c03-규칙상태예외데이터", ["AUD-01", "AUD-04", "AUD-05"], ["foundation", "applied", "advanced"], ["apply-document-quality-profile", "design-game-systems", "design-player-experience", "review-game-design"], ["system-specification", "rule-exception-matrix", "data-schema-table-contract"], ["system-specification", "rule-exception-matrix", "data-schema-table-contract"], "규칙과 상태 전이 및 예외와 데이터 계약의 흐름"],
  ["ST-C04", "competency", "st-c04-uiux온보딩접근성", ["AUD-01", "AUD-04", "AUD-05"], ["foundation", "applied", "advanced"], ["apply-document-quality-profile", "design-player-experience", "review-game-design", "visualize-game-design"], ["ui-ux-flow-state", "accessibility-platform-matrix"], ["ui-ux-flow-state", "accessibility-platform-matrix", "game-design-review"], "UI UX 온보딩과 접근성 검토의 흐름"],
  ["ST-C05", "competency", "st-c05-콘텐츠내러티브퀘스트npc", ["AUD-01", "AUD-04", "AUD-05"], ["foundation", "applied", "advanced"], ["apply-document-quality-profile", "design-game-content", "design-game-systems", "plan-game-production", "review-game-design"], ["narrative-quest-npc", "character-skill-combat-monster"], ["narrative-quest-npc", "character-skill-combat-monster", "game-design-review"], "콘텐츠와 내러티브 및 퀘스트와 NPC 제작 계약의 흐름"],
  ["ST-C06", "competency", "st-c06-캐릭터스킬전투몬스터", ["AUD-01", "AUD-04", "AUD-05"], ["foundation", "applied", "advanced"], ["apply-document-quality-profile", "design-game-content", "design-game-systems", "review-game-design"], ["character-skill-combat-monster", "system-specification"], ["character-skill-combat-monster", "system-specification", "game-design-review"], "캐릭터와 스킬 및 전투와 몬스터 설계의 흐름"],
  ["ST-C07", "competency", "st-c07-성장경제밸런스liveops", ["AUD-04", "AUD-05", "AUD-06"], ["applied", "advanced"], ["apply-document-quality-profile", "design-game-economy-and-liveops", "design-game-systems", "review-game-design"], ["economy-balance", "liveops-experiment-event"], ["economy-balance", "liveops-experiment-event", "game-design-review"], "성장과 경제 및 밸런스와 LiveOps 실험의 흐름"],
  ["ST-C08", "competency", "st-c08-제작검토이미지출력", ["AUD-04", "AUD-05", "AUD-06"], ["applied", "advanced"], ["plan-game-production", "review-game-design", "plan-image-assets", "visualize-game-design", "export-game-design-documents"], ["production-scope-risk", "game-design-review", "decision-change-log"], ["production-scope-risk", "game-design-review", "export-preparation-manifest"], "제작과 검토 및 이미지와 출력 준비의 흐름"],
  ["ST-G01", "concept", "st-g01-모바일-수집형-rpg라이브서비스", ["AUD-01", "AUD-04", "AUD-05"], ["foundation", "applied", "advanced"], ["define-game-vision", "design-game-economy-and-liveops", "design-game-content", "review-game-design"], ["game-design-brief", "economy-balance", "liveops-experiment-event"], ["game-design-brief", "economy-balance", "liveops-experiment-event"], "모바일 수집형 RPG LiveService 콘셉트의 설계 흐름"],
  ["ST-G02", "concept", "st-g02-캐주얼-퍼즐방치형", ["AUD-01", "AUD-04"], ["foundation", "applied"], ["define-game-vision", "design-game-systems", "design-player-experience", "review-game-design"], ["core-motivation-loop", "ui-ux-flow-state"], ["core-motivation-loop", "ui-ux-flow-state", "game-design-review"], "캐주얼 퍼즐 방치형 콘셉트의 세션 루프와 복귀 흐름"],
  ["ST-G03", "concept", "st-g03-협동-생존-액션", ["AUD-01", "AUD-04", "AUD-05"], ["foundation", "applied", "advanced"], ["define-game-vision", "design-game-systems", "design-game-content", "plan-game-production", "review-game-design"], ["system-specification", "character-skill-combat-monster", "production-scope-risk"], ["system-specification", "character-skill-combat-monster", "production-scope-risk"], "협동 생존 액션 콘셉트의 역할과 자원 및 복구 흐름"],
  ["ST-G04", "concept", "st-g04-경쟁-pvp-아레나", ["AUD-01", "AUD-04", "AUD-05"], ["foundation", "applied", "advanced"], ["design-game-systems", "design-game-content", "design-player-experience", "review-game-design"], ["character-skill-combat-monster", "system-specification", "ui-ux-flow-state"], ["character-skill-combat-monster", "system-specification", "ui-ux-flow-state"], "경쟁 PvP 아레나 콘셉트의 counterplay와 가독성 흐름"],
  ["ST-G05", "concept", "st-g05-pc콘솔-액션-로그라이트", ["AUD-01", "AUD-04", "AUD-05"], ["foundation", "applied", "advanced"], ["define-game-vision", "design-game-content", "design-game-systems", "plan-game-production", "review-game-design"], ["core-motivation-loop", "character-skill-combat-monster", "production-scope-risk"], ["core-motivation-loop", "character-skill-combat-monster", "production-scope-risk"], "PC 콘솔 액션 로그라이트 콘셉트의 run loop와 성장 흐름"],
  ["ST-G06", "concept", "st-g06-선택형-내러티브-어드벤처", ["AUD-01", "AUD-04", "AUD-05"], ["foundation", "applied", "advanced"], ["design-game-content", "design-game-systems", "review-game-design", "visualize-game-design"], ["narrative-quest-npc", "system-specification", "rule-exception-matrix"], ["narrative-quest-npc", "system-specification", "rule-exception-matrix"], "선택형 내러티브 어드벤처 콘셉트의 상태와 분기 흐름"],
  ["ST-G07", "concept", "st-g07-코지-생활-시뮬레이션", ["AUD-01", "AUD-04"], ["foundation", "applied"], ["define-game-vision", "design-player-experience", "design-game-content", "review-game-design"], ["ui-ux-flow-state", "narrative-quest-npc", "accessibility-platform-matrix"], ["ui-ux-flow-state", "narrative-quest-npc", "accessibility-platform-matrix"], "코지 생활 시뮬레이션 콘셉트의 자율성과 접근성 흐름"],
  ["ST-G08", "concept", "st-g08-경영타이쿤-시뮬레이션", ["AUD-01", "AUD-04", "AUD-05"], ["foundation", "applied", "advanced"], ["design-game-economy-and-liveops", "design-game-systems", "design-player-experience", "review-game-design"], ["economy-balance", "system-specification", "ui-ux-flow-state"], ["economy-balance", "system-specification", "ui-ux-flow-state"], "경영 타이쿤 시뮬레이션 콘셉트의 경제와 피드백 흐름"],
  ["ST-G09", "concept", "st-g09-샌드박스ugc", ["AUD-01", "AUD-04", "AUD-05", "AUD-06"], ["foundation", "applied", "advanced"], ["design-game-content", "design-game-systems", "design-player-experience", "review-game-design"], ["narrative-quest-npc", "system-specification", "game-design-review"], ["narrative-quest-npc", "system-specification", "game-design-review"], "샌드박스 UGC 콘셉트의 창작과 발견 및 moderation 흐름"],
  ["ST-G10", "concept", "st-g10-교육사회문제접근성-중심-게임", ["AUD-01", "AUD-04", "AUD-06"], ["foundation", "applied", "advanced"], ["define-game-vision", "design-player-experience", "design-game-content", "review-game-design"], ["game-design-brief", "ui-ux-flow-state", "accessibility-platform-matrix"], ["game-design-brief", "ui-ux-flow-state", "accessibility-platform-matrix"], "교육과 사회문제 및 접근성 중심 게임 콘셉트의 검증 흐름"],
].map(([id, view, anchor, audiences, level, skills, templates, outputs, alt]) => ({
  id,
  product: "game-design-studio",
  view,
  document: `guides/game-design-studio/use-cases/${view === "competency" ? "competency-paths" : "concept-scenarios"}.md`,
  anchor,
  audiences,
  level,
  skills,
  templates,
  outputs,
  diagram: {
    svg: `guides/assets/game-design-studio/use-cases/${id.toLowerCase()}.svg`,
    png: `guides/assets/game-design-studio/use-cases/${id.toLowerCase()}.png`,
    alt,
  },
})));
const STUDIO_SKILL_CASE_CONTRACT = Object.freeze([
  ["ST-S01", "apply-document-quality-profile", ["selection-record", "quality-checklist", "requirement-manifest"], ["define-game-vision", "design-game-systems", "design-game-content", "design-player-experience", "design-game-economy-and-liveops", "plan-game-production", "review-game-design", "visualize-game-design", "export-game-design-documents"], "문서 품질 프로필 직접 호출 흐름"],
  ["ST-S02", "define-game-vision", ["vision-pillars", "core-motivation-loop"], ["design-game-systems"], "게임 비전 직접 호출 흐름"],
  ["ST-S03", "design-game-content", ["narrative-quest-npc", "character-skill-combat-monster"], ["review-game-design"], "게임 콘텐츠 직접 호출 흐름"],
  ["ST-S04", "design-game-economy-and-liveops", ["economy-balance", "liveops-experiment-event"], ["review-game-design"], "게임 경제와 LiveOps 직접 호출 흐름"],
  ["ST-S05", "design-game-systems", ["system-specification", "rule-exception-matrix", "data-schema-table-contract"], ["review-game-design"], "게임 시스템 직접 호출 흐름"],
  ["ST-S06", "design-player-experience", ["ui-ux-flow-state", "accessibility-platform-matrix"], ["review-game-design"], "플레이어 경험 직접 호출 흐름"],
  ["ST-S07", "export-game-design-documents", ["export-preparation-manifest", "format-jobs"], [], "게임 기획 문서 출력 직접 호출 흐름"],
  ["ST-S08", "generate-image-assets", ["image-generation-result", "image-generation-provenance"], ["review-image-assets"], "이미지 자산 생성 직접 호출 흐름"],
  ["ST-S09", "orchestrate-game-design-project", ["game-design-brief", "canonical-artifact"], ["define-game-vision", "design-game-systems", "design-game-content", "design-player-experience", "design-game-economy-and-liveops", "plan-game-production", "review-game-design", "visualize-game-design", "export-game-design-documents"], "게임 기획 프로젝트 오케스트레이션 직접 호출 흐름"],
  ["ST-S10", "plan-game-production", ["production-scope-risk", "decision-change-log"], ["review-game-design"], "게임 제작 계획 직접 호출 흐름"],
  ["ST-S11", "plan-image-assets", ["image-assets-manifest", "image-prompts"], ["generate-image-assets", "visualize-game-design"], "이미지 자산 계획 직접 호출 흐름"],
  ["ST-S12", "review-game-design", ["game-design-review", "decision-change-log"], ["review-game-design", "visualize-game-design", "export-game-design-documents"], "게임 기획 검토 직접 호출 흐름"],
  ["ST-S13", "review-image-assets", ["image-asset-review", "lifecycle-receipt"], ["export-game-design-documents"], "이미지 자산 검토 직접 호출 흐름"],
  ["ST-S14", "svg-infographic", ["editable-svg", "png-2x", "render-evidence"], ["visualize-game-design"], "SVG 인포그래픽 직접 호출 흐름"],
  ["ST-S15", "visualize-game-design", ["editable-svg", "png-2x", "visualization-evidence"], ["review-game-design", "export-game-design-documents"], "게임 기획 시각화 직접 호출 흐름"],
].map(([id, skill, outputs, next_skills, alt]) => ({
  id,
  product: "game-design-studio",
  skill,
  document: `guides/game-design-studio/skills/${skill}.md`,
  anchor: `직접-호출-활용-${skill}`,
  outputs,
  next_skills,
  diagram: {
    svg: `guides/assets/game-design-studio/skills/${skill}.svg`,
    png: `guides/assets/game-design-studio/skills/${skill}.png`,
    alt,
  },
})));
const AUDIENCE_BOUNDARY_EXPECTATIONS = Object.freeze({
  "AUD-01": {
    approver: "교사 또는 멘토",
    held: "포트폴리오 증거",
    condition: "규칙이 모호하면",
    action: "관찰과 가정을 다시 읽고, 확인 질문과 다음 실습을 정리해 줘.",
    safety: "학교 정책·출처·개인 기여 확인",
  },
  "AUD-02": {
    approver: "포트폴리오 검토자",
    held: "portfolio brief",
    condition: "공고 정보가 오래됐거나 불완전하면",
    action: "확인일·지역·표본을 다시 조사하고, 증거 계획을 갱신해 줘.",
    safety: "합격·채용 가능성을 주장하지 않습니다",
  },
  "AUD-03": {
    approver: "Career 검토자",
    held: "개인 기여 증거",
    condition: "개인 기여를 입증할 수 없으면",
    action: "이전 경험의 사실, 전이 가능한 역량, 새 증거 과제를 다시 분리해 줘.",
    safety: "NDA·팀 PII·권리 불명 자산은 제거",
  },
  "AUD-04": {
    approver: "프로젝트 담당자",
    held: "도식·파생 형식",
    condition: "renderer 또는 이미지 provider가 없으면",
    action: "MD와 source를 보존하고, 필요한 capability와 재개 조건을 정리해 줘.",
    safety: "미검증 수치나 시장 성과를 추가하지 않습니다",
  },
  "AUD-05": {
    approver: "문서 책임자",
    held: "handoff 패키지",
    condition: "내부 자료·팀 PII·권리 불명 자산이 있으면",
    action: "공개 가능한 사실, 가정, 결정과 재검토 항목만 남겨 handoff 초안을 다시 만들어 줘.",
    safety: "내부 자료·팀 PII·권리 불명 자산은 입력과 공개 evidence에서 제외",
  },
  "AUD-06": {
    approver: "교사 또는 멘토",
    held: "검토 패키지",
    condition: "기관 AI 정책이나 공개 권한이 확인되지 않으면",
    action: "정책과 공개 권한을 확인할 질문, 다음 과제, 사람 피드백 지점을 다시 정리해 줘.",
    safety: "답안 대행·자동 승인 대신",
  },
});

function markdownSections(markdown, level) {
  const marker = "#".repeat(level);
  const headings = [...markdown.matchAll(new RegExp(`^${marker} (.+)$`, "gm"))];
  return headings.map((heading, index) => ({
    heading: heading[1],
    body: markdown.slice(heading.index + heading[0].length, headings[index + 1]?.index).trim(),
  }));
}

function fencedCodeBlocks(markdown, language) {
  return [...markdown.matchAll(/^```([^\n]*)\n([\s\S]*?)\n```$/gm)]
    .filter((match) => match[1] === language)
    .map((match) => match[2]);
}

function replaceCasePart(markdown, caseHeading, partHeading, replacement) {
  const caseBody = sectionByHeading(markdown, 2, caseHeading);
  const partBody = sectionByHeading(caseBody, 3, partHeading);
  assert.notEqual(partBody, replacement, `mutation must change ${caseHeading} ${partHeading}`);
  return markdown.replace(caseBody, caseBody.replace(partBody, replacement));
}

function replaceTableCell(markdown, sectionHeading, rowId, column, replacement) {
  const section = sectionByHeading(markdown, 2, sectionHeading);
  const lines = section.split("\n");
  const headerIndex = lines.findIndex((line) => line.startsWith("|"));
  assert.notEqual(headerIndex, -1, `${sectionHeading} table header`);
  const headings = lines[headerIndex].split("|").slice(1, -1).map((value) => value.trim());
  const columnIndex = headings.indexOf(column);
  assert.notEqual(columnIndex, -1, `${sectionHeading} ${column} column`);
  const rowIndex = lines.findIndex((line, index) => index > headerIndex + 1 && line.startsWith(`| ${rowId} |`));
  assert.notEqual(rowIndex, -1, `${sectionHeading} ${rowId} row`);
  const values = lines[rowIndex].split("|").slice(1, -1).map((value) => value.trim());
  assert.notEqual(values[columnIndex], replacement, `mutation must change ${rowId} ${column}`);
  values[columnIndex] = replacement;
  lines[rowIndex] = `| ${values.join(" | ")} |`;
  return markdown.replace(section, lines.join("\n"));
}

function assertStudioIndexOmitsCaseCards(index) {
  const duplicatedMarkers = markdownSections(index, 3)
    .map(({ heading }) => heading)
    .filter((heading) => STUDIO_COMPETENCY_CASE_MARKERS.includes(heading));
  assert.deepEqual(duplicatedMarkers, [], "Studio index duplicates case-card H3 sections");
}

function assertStudioCompetencySemantics({ competencyPaths, entries, inventory }) {
  assert.deepEqual(
    Object.keys(STUDIO_COMPETENCY_SEMANTIC_CONTRACT),
    entries.map(({ id }) => id),
    "semantic expectation coverage",
  );
  for (const entry of entries) {
    const caseBody = sectionByHeading(competencyPaths, 2, STUDIO_COMPETENCY_HEADINGS[entry.id]);
    const byHeading = new Map(markdownSections(caseBody, 3).map((section) => [section.heading, section.body]));
    const semanticContract = STUDIO_COMPETENCY_SEMANTIC_CONTRACT[entry.id];
    assert.equal(semanticContract.length, STUDIO_COMPETENCY_CASE_MARKERS.length, `${entry.id} semantic section coverage`);
    for (const [index, terms] of semanticContract.entries()) {
      const heading = STUDIO_COMPETENCY_CASE_MARKERS[index];
      const body = byHeading.get(heading);
      assert.ok(body.length >= 40, `${entry.id} ${heading} substantive content`);
      assert.doesNotMatch(body, /^(?:TODO|TBD)(?:\b|$)/iu, `${entry.id} ${heading} placeholder`);
      for (const term of terms) assert.ok(body.includes(term), `${entry.id} ${heading} semantic term: ${term}`);
    }

    const cliBlocks = fencedCodeBlocks(byHeading.get("Codex CLI 요청문"), "text");
    assert.equal(cliBlocks.length, 1, `${entry.id} one CLI code block`);
    const commandLines = cliBlocks[0].split("\n").filter((line) => line.trim().length > 0);
    assert.ok(commandLines.length > 0, `${entry.id} CLI command`);
    for (const command of commandLines) {
      const match = /^\$game-design-studio:([a-z0-9-]+)(?:\s|$)/.exec(command);
      assert.ok(match, `${entry.id} parseable lowercase Studio CLI command: ${command}`);
    }
    const referencedSkills = [...cliBlocks[0].matchAll(/\$game-design-studio:([a-z0-9-]+)/g)].map((match) => match[1]);
    assert.ok(referencedSkills.length > 0, `${entry.id} referenced CLI skills`);
    for (const skillId of referencedSkills) {
      assert.ok(inventory.skillIds.includes(skillId), `${entry.id} installed Studio skill: ${skillId}`);
      assert.ok(entry.skills.includes(skillId), `${entry.id} manifest-bound CLI skill: ${skillId}`);
    }
  }

  const productionCase = sectionByHeading(competencyPaths, 2, STUDIO_COMPETENCY_HEADINGS["ST-C08"]);
  const productionPractice = sectionByHeading(productionCase, 3, "표준 실습");
  for (const [mode, clause] of Object.entries(STUDIO_IMAGE_MODE_SCOPE_CONTRACT)) {
    assert.ok(productionPractice.includes(clause), `ST-C08 ${mode} exact generation scope`);
  }
  assert.match(productionPractice, /non-empty `OPENAI_API_KEY`가 있으면 OpenAI only/);
  assert.match(productionPractice, /실패 후 Codex fallback을 하지 않습니다/);
  const productionReview = sectionByHeading(productionCase, 3, "검토와 승인");
  for (const term of ["production owner", "rights/asset owner", "실제 format QA", "자동 승인하지 않습니다"]) {
    assert.ok(productionReview.includes(term), `ST-C08 review boundary: ${term}`);
  }
}

function assertStudioConceptSemantics({ conceptScenarios, entries, inventory }) {
  assert.deepEqual(
    Object.keys(STUDIO_CONCEPT_SEMANTIC_CONTRACT),
    entries.map(({ id }) => id),
    "concept semantic expectation coverage",
  );
  assert.deepEqual(
    Object.keys(STUDIO_CONCEPT_CLI_SKILLS),
    entries.map(({ id }) => id),
    "concept CLI expectation coverage",
  );
  assert.deepEqual(
    Object.keys(STUDIO_CONCEPT_LATE_SEMANTIC_CONTRACT),
    entries.map(({ id }) => id),
    "concept late-section expectation coverage",
  );

  const h2Sections = markdownSections(conceptScenarios, 2);
  assert.deepEqual(h2Sections.slice(0, entries.length).map(({ heading }) => heading), entries.map(({ id }) => STUDIO_CONCEPT_HEADINGS[id]));
  for (const entry of entries) {
    const caseBody = sectionByHeading(conceptScenarios, 2, STUDIO_CONCEPT_HEADINGS[entry.id]);
    const caseParts = markdownSections(caseBody, 3);
    assert.deepEqual(caseParts.map(({ heading }) => heading), STUDIO_COMPETENCY_CASE_MARKERS, `${entry.id} common case-card shape`);
    for (const part of caseParts) {
      assert.ok(part.body.length >= 40, `${entry.id} ${part.heading} substantive content`);
      assert.doesNotMatch(part.body, /^(?:TODO|TBD)(?:\b|$)/iu, `${entry.id} ${part.heading} placeholder`);
    }
    const byHeading = new Map(caseParts.map((section) => [section.heading, section.body]));

    const current = byHeading.get("현재 상황과 목표");
    assert.deepEqual(inlineFieldLabels(current), STUDIO_CONCEPT_FIELDS, `${entry.id} section-local concept fields`);
    const fields = new Map(inlineFields(current).map(({ label, value }) => [label, value]));
    for (const [label, terms] of Object.entries(STUDIO_CONCEPT_SEMANTIC_CONTRACT[entry.id])) {
      const value = fields.get(label);
      assert.ok(value.length >= 35, `${entry.id} ${label} substantive field`);
      assert.doesNotMatch(value, /^(?:TODO|TBD)(?:\b|$)/iu, `${entry.id} ${label} placeholder`);
      for (const term of terms) assert.ok(value.includes(term), `${entry.id} ${label} semantic term: ${term}`);
    }
    const lateContract = STUDIO_CONCEPT_LATE_SEMANTIC_CONTRACT[entry.id];
    assert.deepEqual(Object.keys(lateContract), STUDIO_CONCEPT_LATE_HEADINGS, `${entry.id} late-section semantic coverage`);
    for (const [heading, terms] of Object.entries(lateContract)) {
      const body = byHeading.get(heading);
      for (const term of terms) assert.ok(body.includes(term), `${entry.id} ${heading} semantic term: ${term}`);
    }

    const appBlocks = fencedCodeBlocks(byHeading.get("Codex App 요청문"), "text");
    assert.equal(appBlocks.length, 1, `${entry.id} one App code block`);
    assert.match(appBlocks[0], /^@Game Design Studio .+$/m, `${entry.id} executable App request`);

    const cliBlocks = fencedCodeBlocks(byHeading.get("Codex CLI 요청문"), "text");
    assert.equal(cliBlocks.length, 1, `${entry.id} one CLI code block`);
    const match = /^\$game-design-studio:([a-z0-9-]+)(?:\s|$)/.exec(cliBlocks[0]);
    assert.ok(match, `${entry.id} parseable Studio CLI command`);
    assert.equal(match[1], STUDIO_CONCEPT_CLI_SKILLS[entry.id], `${entry.id} exact CLI skill binding`);
    assert.ok(inventory.skillIds.includes(match[1]), `${entry.id} installed Studio skill: ${match[1]}`);
    assert.ok(entry.skills.includes(match[1]), `${entry.id} manifest-bound CLI skill: ${match[1]}`);

    const flow = byHeading.get("스킬·템플릿 흐름");
    for (const skill of entry.skills) assert.ok(flow.includes(`\`${skill}\``), `${entry.id} skill ${skill}`);
    for (const template of entry.templates) assert.ok(flow.includes(`\`${template}\``), `${entry.id} template ${template}`);

    const results = byHeading.get("결과물");
    for (const label of ["최소 결과", "선택 결과", "확장 결과", "파일 트리", "대표 내용"]) {
      assert.ok(results.includes(`**${label}:**`), `${entry.id} ${label}`);
    }
    for (const output of entry.outputs) assert.ok(results.includes(`\`${output}\``), `${entry.id} output ${output}`);

    const review = byHeading.get("검토와 승인");
    assert.match(review, /\*\*사람 결정:\*\*/);
    assert.match(review, /자동.*승인(?:하지 않|되지는 않)|승인을 대신하지 않/);
    assert.match(review, /읽는 순서/);

    const resume = byHeading.get("실패·재개");
    assert.match(resume, /\*\*보존:\*\*/);
    assert.match(resume, /\*\*재개 요청문:\*\*\n\n```text\n(?:@Game Design Studio|\$game-design-studio:)[^\n]+\n```/m, `${entry.id} executable resume`);
  }

  assertNoUnqualifiedNumericClaims(conceptScenarios);
}

function assertNoUnqualifiedNumericClaims(markdown) {
  const claimPattern = /retention|리텐션|시장성|시장\s*규모|시장\s*점유율|KPI|재미|밸런스|balance|효과/iu;
  const numericPattern = /\d+(?:[.,]\d+)?\s*(?:%|점|배|조\s*원|억\s*원|만\s*원|원|명|일|회)?/u;
  const validationPattern = /prototype|telemetry|simulation|사람(?:의)?\s*(?:검토|결정)|가정|검증|provisional|관찰|평가|근거/iu;
  const contradictionPattern = /보장|정답|확정(?:한다|이다)|달성(?:한다|을 보장)/u;
  const sentences = markdown.split(/(?<=[.!?])\s+|\n+/u).map((sentence) => sentence.trim()).filter(Boolean);
  for (const sentence of sentences) {
    const normalized = sentence.replace(/ST-[CG]\d+/gu, "");
    const claim = claimPattern.exec(normalized);
    if (!claim) continue;
    const before = normalized.slice(Math.max(0, claim.index - 12), claim.index);
    const after = normalized.slice(claim.index, claim.index + 80);
    const hasNumericOutcome = numericPattern.test(after) || /D\d+\s*$/u.test(before);
    if (!hasNumericOutcome) continue;
    assert.match(sentence, validationPattern, `unqualified numeric outcome claim: ${sentence}`);
    assert.doesNotMatch(sentence, contradictionPattern, `contradictory numeric outcome claim: ${sentence}`);
  }
}

function assertStudioConceptComparison({ conceptScenarios, competencyPaths, entries }) {
  assert.deepEqual(
    Object.keys(STUDIO_CONCEPT_COMPARISON_CONTRACT),
    entries.map(({ id }) => id),
    "comparison expectation coverage",
  );
  const rows = tableRows(conceptScenarios, "콘셉트 간 비교");
  assert.deepEqual(rows.map((row) => row["ID"]), entries.map(({ id }) => id));
  assert.deepEqual(Object.keys(rows[0]), [
    "ID", "핵심 루프", "실패·복구", "정보 부하", "사회적 위험", "콘텐츠 주기", "필요한 근거", "연결 역량",
  ]);
  const competencyAnchors = collectHeadingAnchors(competencyPaths);
  for (const row of rows) {
    const contract = STUDIO_CONCEPT_COMPARISON_CONTRACT[row.ID];
    for (const heading of ["핵심 루프", "실패·복구", "정보 부하", "사회적 위험", "콘텐츠 주기", "필요한 근거"]) {
      assert.ok(row[heading].length >= 8, `${row.ID} ${heading} comparison`);
      for (const term of contract[heading]) assert.ok(row[heading].includes(term), `${row.ID} ${heading} semantic term: ${term}`);
    }
    const links = [...row["연결 역량"].matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((match) => ({ id: match[1], target: match[2] }));
    assert.deepEqual(links.map(({ id }) => id), contract.competencies, `${row.ID} exact competency IDs`);
    for (const { id, target } of links) {
      assert.equal(target, STUDIO_COMPETENCY_LINK_TARGETS[id], `${row.ID} ${id} exact competency target`);
      const [relativePath, anchor] = target.split("#");
      assert.equal(relativePath, "competency-paths.md", `${row.ID} ${id} competency document`);
      assert.ok(competencyAnchors.has(anchor), `${row.ID} ${id} resolved competency anchor: ${anchor}`);
    }
  }
}

function sectionByHeading(markdown, level, heading) {
  const section = markdownSections(markdown, level).find((entry) => entry.heading === heading);
  assert.ok(section, `missing H${level} section: ${heading}`);
  return section.body;
}

function fieldLabels(markdown) {
  return [...markdown.matchAll(/^\*\*([^*\n]+):\*\*/gm)].map((match) => match[1]);
}

function inlineFieldLabels(markdown) {
  return inlineFields(markdown).map(({ label }) => label);
}

function inlineFields(markdown) {
  const matches = [...markdown.matchAll(/\*\*([^*\n]+):\*\*/g)];
  return matches.map((match, index) => ({
    label: match[1],
    value: markdown.slice(match.index + match[0].length, matches[index + 1]?.index).trim(),
  }));
}

function codeValue(markdown, label) {
  const match = /`([^`]+)`/.exec(markdown);
  assert.ok(match, `${label} executable request`);
  return match[1];
}

function terminalPunctuationTrimmed(value) {
  return value.replace(/[.。]$/, "");
}

function tableHeadings(markdown, sectionHeading) {
  const body = sectionByHeading(markdown, 2, sectionHeading);
  const [header, separator, ...rows] = body.split("\n").filter((line) => line.startsWith("|"));
  assert.match(separator, /^\|(?:\s*:?-+:?\s*\|)+$/);
  assert.ok(rows.length > 0, `${sectionHeading} must contain data rows`);
  return header.split("|").slice(1, -1).map((value) => value.trim());
}

function tableRows(markdown, sectionHeading) {
  const body = sectionByHeading(markdown, 2, sectionHeading);
  const [header, separator, ...rows] = body.split("\n").filter((line) => line.startsWith("|"));
  const headings = header.split("|").slice(1, -1).map((value) => value.trim());
  assert.match(separator, /^\|(?:\s*:?-+:?\s*\|)+$/);
  return rows.map((row) => Object.fromEntries(headings.map((heading, index) => [heading, row.split("|").slice(1, -1)[index].trim()])));
}

async function readCommonGuides() {
  const useCaseRoot = path.join(repoRoot, "guides", "use-cases");
  const filenames = {
    hub: path.join(useCaseRoot, "README.md"),
    audiencePaths: path.join(useCaseRoot, "audience-paths.md"),
    outputCatalog: path.join(useCaseRoot, "output-catalog.md"),
  };
  for (const filename of Object.values(filenames)) {
    const stat = await lstat(filename);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `expected regular file: ${filename}`);
  }
  const [hub, audiencePaths, outputCatalog] = await Promise.all([
    readFile(filenames.hub, "utf8"),
    readFile(filenames.audiencePaths, "utf8"),
    readFile(filenames.outputCatalog, "utf8"),
  ]);
  return { hub, audiencePaths, outputCatalog };
}

async function readStudioUseCaseGuides() {
  const useCaseRoot = path.join(repoRoot, "guides", "game-design-studio", "use-cases");
  const filenames = {
    index: path.join(useCaseRoot, "README.md"),
    competencyPaths: path.join(useCaseRoot, "competency-paths.md"),
    conceptScenarios: path.join(useCaseRoot, "concept-scenarios.md"),
  };
  for (const filename of Object.values(filenames)) {
    const stat = await lstat(filename);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `expected regular file: ${filename}`);
  }
  const [index, competencyPaths, conceptScenarios] = await Promise.all([
    readFile(filenames.index, "utf8"),
    readFile(filenames.competencyPaths, "utf8"),
    readFile(filenames.conceptScenarios, "utf8"),
  ]);
  return { index, competencyPaths, conceptScenarios };
}

test("use-case manifest exposes the versioned three-lane contract", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  assert.equal(manifest.version, 1);
  assert.ok(Array.isArray(manifest.audience_paths));
  assert.ok(Array.isArray(manifest.cases));
  assert.ok(Array.isArray(manifest.skill_cases));
});

test("Studio manifest declares the ordered case and installed-skill coverage with deferred guide targets", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const studioCases = manifest.cases.filter((entry) => entry.product === "game-design-studio");
  const competencyCases = studioCases.filter((entry) => entry.view === "competency");
  const conceptCases = studioCases.filter((entry) => entry.view === "concept");
  const studioSkillCases = manifest.skill_cases.filter((entry) => entry.product === "game-design-studio");
  const inventory = await collectProductInventory(repoRoot, "game-design-studio");

  assert.deepEqual(competencyCases.map((entry) => entry.id), [
    "ST-C01", "ST-C02", "ST-C03", "ST-C04", "ST-C05", "ST-C06", "ST-C07", "ST-C08",
  ]);
  assert.deepEqual(conceptCases.map((entry) => entry.id), [
    "ST-G01", "ST-G02", "ST-G03", "ST-G04", "ST-G05",
    "ST-G06", "ST-G07", "ST-G08", "ST-G09", "ST-G10",
  ]);
  assert.equal(studioSkillCases.length, 15);
  const projectCase = ({ id, product, view, document, anchor, audiences, level, skills, templates, outputs, diagram }) => ({
    id, product, view, document, anchor, audiences, level, skills, templates, outputs,
    diagram: { svg: diagram.svg, png: diagram.png, alt: diagram.alt },
  });
  const projectSkillCase = ({ id, product, skill, document, anchor, outputs, next_skills, diagram }) => ({
    id, product, skill, document, anchor, outputs, next_skills,
    diagram: { svg: diagram.svg, png: diagram.png, alt: diagram.alt },
  });
  assert.deepEqual(studioCases.map(projectCase), STUDIO_CASE_CONTRACT, "all Studio case metadata matches the declared coverage contract");
  assert.deepEqual(studioSkillCases.map(projectSkillCase), STUDIO_SKILL_CASE_CONTRACT, "all Studio direct-use metadata matches the declared coverage contract");
  assert.deepEqual(studioSkillCases.map((entry) => entry.skill), inventory.skillIds, "one direct-use case for every installed Studio skill");

  const result = await validateUseCaseGuides({
    repoRoot,
    inventories: new Map([["game-design-studio", inventory]]),
    validateTargets: false,
  });
  assert.equal(result.ok, true, "Studio declarations validate before their guide and diagram targets exist");
  assert.equal(result.targetValidation, "deferred");
  assert.equal(
    result.deferredTargetPaths.filter((target) => target.startsWith("guides/game-design-studio/") || target.startsWith("guides/assets/game-design-studio/")).length,
    99,
  );
  assert.ok(result.deferredTargetPaths.includes("guides/game-design-studio/use-cases/competency-paths.md"));
  assert.ok(result.deferredTargetPaths.includes("guides/game-design-studio/use-cases/concept-scenarios.md"));
  assert.ok(result.deferredTargetPaths.includes("guides/assets/game-design-studio/use-cases/st-c01.svg"));
  assert.ok(result.deferredTargetPaths.includes("guides/assets/game-design-studio/use-cases/st-g10.png"));
  assert.ok(result.deferredTargetPaths.includes("guides/game-design-studio/skills/svg-infographic.md"));
  assert.ok(result.deferredTargetPaths.includes("guides/assets/game-design-studio/skills/svg-infographic.png"));
});

test("Studio use-case index routes all eighteen published competency and concept cases", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { index } = await readStudioUseCaseGuides();
  const studioCases = manifest.cases.filter((entry) => entry.product === "game-design-studio");
  const links = [...index.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((match) => ({ label: match[1], target: match[2] }));

  for (const entry of studioCases) {
    const caseLinks = links.filter(({ label }) => label.includes(entry.id));
    assert.equal(caseLinks.length, 1, `${entry.id} index link`);
    if (entry.view === "competency") {
      assert.equal(caseLinks[0].target, `competency-paths.md#${entry.anchor}`, `${entry.id} published route`);
    } else {
      assert.equal(caseLinks[0].target, `concept-scenarios.md#${entry.anchor}`, `${entry.id} published route`);
      assert.doesNotMatch(caseLinks[0].label, /예정/, `${entry.id} published label`);
    }
  }
  assert.equal(links.filter(({ target }) => target.startsWith("concept-scenarios.md#st-g")).length, 10, "all concept guides are linked");
  assert.ok(links.some(({ target }) => target === "#스킬-워크벤치-예정"), "skill workbench scheduled route");
  assert.ok(links.some(({ target }) => target === "#studio-faq-예정"), "Studio FAQ scheduled route");
  assert.ok(links.some(({ target }) => target === "../../use-cases/output-catalog.md"), "output catalog route");
  const indexAnchors = collectHeadingAnchors(index);
  for (const { target } of links) {
    const [relativePath, anchor] = target.split("#");
    const targetMarkdown = relativePath
      ? await readFile(path.resolve(repoRoot, "guides/game-design-studio/use-cases", relativePath), "utf8")
      : index;
    if (anchor) assert.ok(collectHeadingAnchors(targetMarkdown).has(anchor), `resolved index anchor: ${target}`);
    if (!relativePath && anchor) assert.ok(indexAnchors.has(anchor), `local index anchor: ${target}`);
  }

  const decisionRows = tableRows(index, "역량·콘셉트·스킬 선택");
  assert.deepEqual(decisionRows.map((row) => row["진입점"]), ["역량", "콘셉트", "스킬"]);
  const learningPaths = sectionByHeading(index, 2, "학습 경로");
  for (const pathName of ["입문", "응용", "포트폴리오", "전체 프로젝트"]) {
    assert.match(learningPaths, new RegExp(`^### ${pathName}$`, "m"), `${pathName} path`);
  }
  assertStudioIndexOmitsCaseCards(index);
});

test("each Studio concept preserves the common case-card, local constraints, and executable artifact contract", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { conceptScenarios, competencyPaths } = await readStudioUseCaseGuides();
  const inventory = await collectProductInventory(repoRoot, "game-design-studio");
  const entries = manifest.cases.filter((entry) => entry.product === "game-design-studio" && entry.view === "concept");
  const anchors = collectHeadingAnchors(conceptScenarios);

  assert.equal(entries.length, 10);
  for (const entry of entries) assert.ok(anchors.has(entry.anchor), `${entry.id} manifest anchor`);
  assertStudioConceptSemantics({ conceptScenarios, entries, inventory });
  assert.doesNotMatch(conceptScenarios, /!\[[^\]]*\]\([^)]+\)/, "Task 6 owns concept diagram embeds");

  assertStudioConceptComparison({ conceptScenarios, competencyPaths, entries });
});

test("Studio concept contracts reject wrong-valid swaps, TODOs, unsupported claims, and wrong CLI bindings", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { conceptScenarios } = await readStudioUseCaseGuides();
  const inventory = await collectProductInventory(repoRoot, "game-design-studio");
  const entries = manifest.cases.filter((entry) => entry.product === "game-design-studio" && entry.view === "concept");
  const g01Heading = STUDIO_CONCEPT_HEADINGS["ST-G01"];
  const g02Heading = STUDIO_CONCEPT_HEADINGS["ST-G02"];

  const g01Current = sectionByHeading(sectionByHeading(conceptScenarios, 2, g01Heading), 3, "현재 상황과 목표");
  const g02Current = sectionByHeading(sectionByHeading(conceptScenarios, 2, g02Heading), 3, "현재 상황과 목표");
  const validSwap = replaceCasePart(
    replaceCasePart(conceptScenarios, g01Heading, "현재 상황과 목표", g02Current),
    g02Heading,
    "현재 상황과 목표",
    g01Current,
  );
  assert.throws(
    () => assertStudioConceptSemantics({ conceptScenarios: validSwap, entries, inventory }),
    /ST-G01 플레이어 맥락 semantic term: 모바일/,
  );

  const todoCurrent = g01Current.replace(
    /\*\*설계 제약:\*\*[\s\S]*?(?=\*\*전이 가능한 역량:\*\*)/,
    "**설계 제약:** TODO\n\n",
  );
  const todoMutation = replaceCasePart(conceptScenarios, g01Heading, "현재 상황과 목표", todoCurrent);
  assert.throws(
    () => assertStudioConceptSemantics({ conceptScenarios: todoMutation, entries, inventory }),
    /ST-G01 설계 제약 substantive field/,
  );

  const g01Cli = sectionByHeading(sectionByHeading(conceptScenarios, 2, g01Heading), 3, "Codex CLI 요청문");
  const wrongValidCli = replaceCasePart(
    conceptScenarios,
    g01Heading,
    "Codex CLI 요청문",
    g01Cli.replace("$game-design-studio:design-game-economy-and-liveops", "$game-design-studio:define-game-vision"),
  );
  assert.throws(
    () => assertStudioConceptSemantics({ conceptScenarios: wrongValidCli, entries, inventory }),
    /ST-G01 exact CLI skill binding/,
  );

  const unsupportedClaim = conceptScenarios.replace(
    "D30 retention 수치는 prototype과 telemetry로 검증할 가정입니다.",
    "D30 retention은 40% 달성을 보장한다고 둔 가정입니다.",
  );
  assert.notEqual(unsupportedClaim, conceptScenarios, "unsupported-claim mutation must change source");
  assert.throws(
    () => assertStudioConceptSemantics({ conceptScenarios: unsupportedClaim, entries, inventory }),
    /contradictory numeric outcome claim/,
  );
});

test("Studio concept contract rejects swapped or empty late case-card sections", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { conceptScenarios } = await readStudioUseCaseGuides();
  const inventory = await collectProductInventory(repoRoot, "game-design-studio");
  const entries = manifest.cases.filter((entry) => entry.product === "game-design-studio" && entry.view === "concept");
  const g01Heading = STUDIO_CONCEPT_HEADINGS["ST-G01"];
  const g02Heading = STUDIO_CONCEPT_HEADINGS["ST-G02"];
  const mutations = [
    ["검토와 승인", /ST-G01 검토와 승인 semantic term: design·economy·policy owner/],
    ["실패·재개", /ST-G01 실패·재개 semantic term: 지표 정의/],
    ["자기점검과 다음 학습", /ST-G01 자기점검과 다음 학습 semantic term: 수집·성장·이벤트/],
  ].map(([partHeading, expectedFailure]) => {
    const g01 = sectionByHeading(sectionByHeading(conceptScenarios, 2, g01Heading), 3, partHeading);
    const g02 = sectionByHeading(sectionByHeading(conceptScenarios, 2, g02Heading), 3, partHeading);
    return [
      `swap ${partHeading}`,
      replaceCasePart(replaceCasePart(conceptScenarios, g01Heading, partHeading, g02), g02Heading, partHeading, g01),
      expectedFailure,
    ];
  });
  mutations.push([
    "empty self-check",
    replaceCasePart(conceptScenarios, g01Heading, "자기점검과 다음 학습", ""),
    /ST-G01 자기점검과 다음 학습 substantive content/,
  ]);

  for (const [name, mutation, expectedFailure] of mutations) {
    assert.throws(
      () => assertStudioConceptSemantics({ conceptScenarios: mutation, entries, inventory }),
      expectedFailure,
      name,
    );
  }
});

test("Studio concept contract rejects unqualified numeric outcome claims", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { conceptScenarios } = await readStudioUseCaseGuides();
  const inventory = await collectProductInventory(repoRoot, "game-design-studio");
  const entries = manifest.cases.filter((entry) => entry.product === "game-design-studio" && entry.view === "concept");
  const claims = [
    "retention은 40%입니다.",
    "시장성은 80%입니다.",
    "시장 규모는 1조 원입니다.",
    "KPI는 70%입니다.",
    "재미는 90점입니다.",
    "밸런스는 95점입니다.",
    "학습 효과는 60%입니다.",
  ];
  for (const claim of claims) {
    const mutation = conceptScenarios.replace("이 문서는", `${claim}\n\n이 문서는`);
    assert.notEqual(mutation, conceptScenarios, `numeric claim mutation: ${claim}`);
    assert.throws(
      () => assertStudioConceptSemantics({ conceptScenarios: mutation, entries, inventory }),
      /unqualified numeric outcome claim/,
      claim,
    );
  }

  for (const qualifiedClaim of [
    "retention은 40%라는 가정이며 prototype과 telemetry로 검증합니다.",
    "시장성은 80%라는 가정이며 사람 검토로 검증합니다.",
    "시장 규모는 1조 원이라는 가정이며 simulation 근거로 검증합니다.",
  ]) {
    const qualified = conceptScenarios.replace("이 문서는", `${qualifiedClaim}\n\n이 문서는`);
    assert.doesNotThrow(
      () => assertStudioConceptSemantics({ conceptScenarios: qualified, entries, inventory }),
      qualifiedClaim,
    );
  }
});

test("Studio comparison contract rejects axis, competency, and anchor mutations", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { conceptScenarios, competencyPaths } = await readStudioUseCaseGuides();
  const entries = manifest.cases.filter((entry) => entry.product === "game-design-studio" && entry.view === "concept");
  const rows = tableRows(conceptScenarios, "콘셉트 간 비교");
  const g01 = rows.find((row) => row.ID === "ST-G01");
  const g02 = rows.find((row) => row.ID === "ST-G02");
  const mutations = [
    ["axis swap", replaceTableCell(replaceTableCell(conceptScenarios, "콘셉트 간 비교", "ST-G01", "핵심 루프", g02["핵심 루프"]), "콘셉트 간 비교", "ST-G02", "핵심 루프", g01["핵심 루프"]), /ST-G01 핵심 루프 semantic term: 수집/],
    ["wrong-valid competency", replaceTableCell(conceptScenarios, "콘셉트 간 비교", "ST-G01", "연결 역량", "[ST-C03](competency-paths.md#st-c03-규칙상태예외데이터), [ST-C07](competency-paths.md#st-c07-성장경제밸런스liveops)"), /ST-G01 exact competency IDs/],
    ["nonexistent anchor", replaceTableCell(conceptScenarios, "콘셉트 간 비교", "ST-G01", "연결 역량", "[ST-C02](competency-paths.md#st-c02-존재하지-않는-anchor), [ST-C07](competency-paths.md#st-c07-성장경제밸런스liveops)"), /ST-G01 ST-C02 exact competency target/],
  ];
  for (const [name, mutation, expectedFailure] of mutations) {
    assert.throws(
      () => assertStudioConceptComparison({ conceptScenarios: mutation, competencyPaths, entries }),
      expectedFailure,
      name,
    );
  }
});

test("each Studio competency case preserves its anchored case-card and executable review contract", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { competencyPaths } = await readStudioUseCaseGuides();
  const inventory = await collectProductInventory(repoRoot, "game-design-studio");
  const entries = manifest.cases.filter((entry) => entry.product === "game-design-studio" && entry.view === "competency");
  const h2Sections = markdownSections(competencyPaths, 2);
  const anchors = collectHeadingAnchors(competencyPaths);

  assert.equal(entries.length, 8);
  assert.deepEqual(h2Sections.map(({ heading }) => heading), entries.map(({ id }) => STUDIO_COMPETENCY_HEADINGS[id]));
  for (const entry of entries) {
    assert.ok(anchors.has(entry.anchor), `${entry.id} manifest anchor`);
    const caseSection = h2Sections.find(({ heading }) => heading === STUDIO_COMPETENCY_HEADINGS[entry.id]);
    assert.ok(caseSection, `${entry.id} H2 section`);
    const caseParts = markdownSections(caseSection.body, 3);
    assert.deepEqual(caseParts.map(({ heading }) => heading), STUDIO_COMPETENCY_CASE_MARKERS, `${entry.id} case-card shape`);
    for (const part of caseParts) assert.ok(part.body.length > 0, `${entry.id} ${part.heading} content`);
    const byHeading = new Map(caseParts.map((section) => [section.heading, section.body]));

    const appRequest = byHeading.get("Codex App 요청문");
    assert.match(appRequest, /^```text\n@Game Design Studio .+\n```$/ms, `${entry.id} App request block`);
    const cliRequest = byHeading.get("Codex CLI 요청문");
    assert.match(cliRequest, /^```text\n\$game-design-studio:[\w-]+ .+\n```$/ms, `${entry.id} CLI request block`);

    const flow = byHeading.get("스킬·템플릿 흐름");
    for (const skill of entry.skills) assert.match(flow, new RegExp("`" + skill + "`"), `${entry.id} skill ${skill}`);
    for (const template of entry.templates) assert.match(flow, new RegExp("`" + template + "`"), `${entry.id} template ${template}`);
    assert.match(flow, /역할 경계/);

    const results = byHeading.get("결과물");
    for (const level of ["최소 결과", "선택 결과", "확장 결과", "파일 트리", "대표 내용"] ) {
      assert.match(results, new RegExp("\\*\\*" + level + ":\\*\\*"), `${entry.id} ${level}`);
    }
    for (const output of entry.outputs) assert.match(results, new RegExp("`" + output + "`"), `${entry.id} output ${output}`);

    const review = byHeading.get("검토와 승인");
    assert.match(review, /\*\*사람 결정:\*\*/);
    assert.match(review, /자동.*승인(?:하지 않|되지는 않)|승인을 대신하지 않/);
    assert.match(review, /읽는 순서/);

    const resume = byHeading.get("실패·재개");
    assert.match(resume, /\*\*보존:\*\*/);
    assert.match(resume, /\*\*재개 요청문:\*\*\n\n```text\n(?:@Game Design Studio|\$game-design-studio:)[^\n]+\n```/m, `${entry.id} executable resume`);
  }

  assert.doesNotMatch(competencyPaths, /!\[[^\]]*\]\([^)]+\)/, "Task 6 owns competency diagram embeds");
  const productionCase = sectionByHeading(competencyPaths, 2, STUDIO_COMPETENCY_HEADINGS["ST-C08"]);
  const productionPractice = sectionByHeading(productionCase, 3, "표준 실습");
  for (const mode of ["prompt-only", "select", "required", "all"]) {
    assert.match(productionPractice, new RegExp("`" + mode + "`"), `ST-C08 IMAGE_GEN_MODE ${mode}`);
  }
  assert.match(productionPractice, /OpenAI only/);
  assert.match(productionPractice, /fallback을 하지 않습니다/);
  assertStudioCompetencySemantics({ competencyPaths, entries, inventory });
});

test("Studio competency contracts reject wrong-valid CLI, semantic, image-mode, and index mutations", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { index, competencyPaths } = await readStudioUseCaseGuides();
  const inventory = await collectProductInventory(repoRoot, "game-design-studio");
  const entries = manifest.cases.filter((entry) => entry.product === "game-design-studio" && entry.view === "competency");
  const c03Heading = STUDIO_COMPETENCY_HEADINGS["ST-C03"];
  const c04Heading = STUDIO_COMPETENCY_HEADINGS["ST-C04"];

  const c03Cli = sectionByHeading(sectionByHeading(competencyPaths, 2, c03Heading), 3, "Codex CLI 요청문");
  const unknownCli = replaceCasePart(
    competencyPaths,
    c03Heading,
    "Codex CLI 요청문",
    c03Cli.replace("$game-design-studio:design-game-systems", "$game-design-studio:not-installed"),
  );
  assert.throws(
    () => assertStudioCompetencySemantics({ competencyPaths: unknownCli, entries, inventory }),
    /ST-C03 installed Studio skill: not-installed/,
  );

  const wrongCaseCli = replaceCasePart(
    competencyPaths,
    c03Heading,
    "Codex CLI 요청문",
    c03Cli.replace("$game-design-studio:design-game-systems", "$game-design-studio:define-game-vision"),
  );
  assert.throws(
    () => assertStudioCompetencySemantics({ competencyPaths: wrongCaseCli, entries, inventory }),
    /ST-C03 manifest-bound CLI skill: define-game-vision/,
  );

  const c03Todo = replaceCasePart(competencyPaths, c03Heading, "표준 실습", "TODO");
  assert.throws(
    () => assertStudioCompetencySemantics({ competencyPaths: c03Todo, entries, inventory }),
    /ST-C03 표준 실습 substantive content/,
  );

  const c03Current = sectionByHeading(sectionByHeading(competencyPaths, 2, c03Heading), 3, "현재 상황과 목표");
  const c04Current = sectionByHeading(sectionByHeading(competencyPaths, 2, c04Heading), 3, "현재 상황과 목표");
  const c03C04Swap = replaceCasePart(
    replaceCasePart(competencyPaths, c03Heading, "현재 상황과 목표", c04Current),
    c04Heading,
    "현재 상황과 목표",
    c03Current,
  );
  assert.throws(
    () => assertStudioCompetencySemantics({ competencyPaths: c03C04Swap, entries, inventory }),
    /ST-C03 현재 상황과 목표 semantic term: authoritative state/,
  );

  const productionHeading = STUDIO_COMPETENCY_HEADINGS["ST-C08"];
  const productionPractice = sectionByHeading(sectionByHeading(competencyPaths, 2, productionHeading), 3, "표준 실습");
  const promptClause = STUDIO_IMAGE_MODE_SCOPE_CONTRACT["prompt-only"];
  const selectClause = STUDIO_IMAGE_MODE_SCOPE_CONTRACT.select;
  const swappedModePractice = productionPractice
    .replace(promptClause, "__PROMPT_SCOPE__")
    .replace(selectClause, "`prompt-only`는 실제 사용자의 immutable receipt에 든 ordered stable IDs만")
    .replace("__PROMPT_SCOPE__", "`select`는 외부 호출 없이 prompt/placeholder만");
  const modeSwap = replaceCasePart(competencyPaths, productionHeading, "표준 실습", swappedModePractice);
  assert.throws(
    () => assertStudioCompetencySemantics({ competencyPaths: modeSwap, entries, inventory }),
    /ST-C08 prompt-only exact generation scope/,
  );

  const duplicatedIndex = index + "\n### 현재 상황과 목표\n\n복제된 case-card 본문입니다.\n";
  assert.throws(() => assertStudioIndexOmitsCaseCards(duplicatedIndex), /duplicates case-card H3 sections/);
});

test("common use-case hub has the exact H2 navigation and twelve FAQ IDs", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { hub, audiencePaths } = await readCommonGuides();

  assert.deepEqual(
    [...hub.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
    [
      "무엇을 할 수 있나요",
      "누구를 위한 가이드인가요",
      "역량·콘셉트·스킬 중 선택하기",
      "작업 규모 선택하기",
      "결과물 먼저 보기",
      "공통 FAQ",
      "제품별 상세 가이드",
    ],
  );
  assert.deepEqual(
    [...hub.matchAll(/^### Q(\d{2})\b/gm)].map((match) => match[1]),
    ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"],
  );
  for (const entry of manifest.audience_paths) {
    assert.ok(collectHeadingAnchors(audiencePaths).has(entry.anchor), entry.id + " anchor");
  }
});

test("each common FAQ answer provides the six executable and evidence fields", async () => {
  const { hub } = await readCommonGuides();
  const faq = sectionByHeading(hub, 2, "공통 FAQ");
  const answers = markdownSections(faq, 3);

  assert.equal(answers.length, 12);
  for (const answer of answers) {
    assert.match(answer.heading, /^Q(?:0[1-9]|1[0-2])\. /, `invalid FAQ ID: ${answer.heading}`);
    assert.deepEqual(fieldLabels(answer.body), FAQ_ANSWER_FIELDS, `${answer.heading} answer shape`);
  }
});

test("each audience route preserves its executable case, output, review, and resume contract", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { audiencePaths } = await readCommonGuides();
  const routes = markdownSections(audiencePaths, 2).filter(({ heading }) => heading.startsWith("AUD-"));

  assert.equal(routes.length, manifest.audience_paths.length);
  assert.deepEqual(
    Object.keys(AUDIENCE_BOUNDARY_EXPECTATIONS).sort(),
    manifest.audience_paths.map(({ id }) => id).sort(),
    "AUD boundary expectation coverage",
  );
  const routeIds = new Set();
  for (const route of routes) {
    const id = /^((?:AUD)-\d{2})\b/.exec(route.heading)?.[1];
    assert.ok(id, `audience ID heading: ${route.heading}`);
    assert.ok(!routeIds.has(id), `duplicate audience route: ${id}`);
    routeIds.add(id);
    const entry = manifest.audience_paths.find((candidate) => candidate.id === id);
    assert.ok(entry, `manifest audience entry: ${id}`);
    const boundary = AUDIENCE_BOUNDARY_EXPECTATIONS[id];
    const sections = markdownSections(route.body, 3);
    assert.deepEqual(sections.map(({ heading }) => heading), AUDIENCE_SECTION_HEADINGS, `${entry.id} section shape`);

    const byHeading = new Map(sections.map((section) => [section.heading, section.body]));
    for (const section of sections) assert.ok(section.body.length > 0, `${entry.id} ${section.heading} content`);
    const routeBody = byHeading.get("권장 경로와 사례");
    for (const phase of ["입문", "기초", "응용", "포트폴리오", "전체 프로젝트"]) {
      assert.match(routeBody, new RegExp(phase), `${entry.id} ${phase} route`);
    }
    assert.match(routeBody, /`(?:ST|CA)-(?:C|T)\d{2}`/, `${entry.id} recommended case ID`);

    const requestBody = byHeading.get("실행 요청");
    assert.match(requestBody, /^\*\*App 요청:\*\* `@Game Design (?:Studio|Career) .+`$/m, `${entry.id} App request`);
    assert.match(requestBody, /^\*\*CLI 요청:\*\* `\$game-design-(?:studio|career):[\w-]+ .+`$/m, `${entry.id} CLI request`);

    const resultBody = byHeading.get("결과와 검토·재개 경계");
    assert.deepEqual(inlineFieldLabels(resultBody), [
      "최소 결과",
      "선택 결과",
      "확장 결과",
      "승인 주체",
      "보류 대상",
      "사람 검토·승인 경계",
      "재개 조건·요청",
      "안전·증거 경계",
    ], `${entry.id} result levels and review/resume fields`);
    const resultFields = new Map(inlineFields(resultBody).map((field) => [field.label, field.value]));
    const reviewBoundary = resultFields.get("사람 검토·승인 경계");
    assert.equal(terminalPunctuationTrimmed(resultFields.get("승인 주체")), boundary.approver, `${entry.id} approval authority`);
    assert.equal(terminalPunctuationTrimmed(resultFields.get("보류 대상")), boundary.held, `${entry.id} held result`);
    assert.ok(reviewBoundary.includes(boundary.approver), `${entry.id} boundary authority`);
    assert.ok(reviewBoundary.includes(boundary.held), `${entry.id} boundary held result`);
    assert.match(reviewBoundary, /승인 전에는/, `${entry.id} approval gate`);
    const resume = resultFields.get("재개 조건·요청");
    assert.ok(resume.startsWith(boundary.condition), `${entry.id} resume condition`);
    assert.equal(codeValue(resume, `${entry.id} resume`), boundary.action, `${entry.id} resume action`);
    assert.ok(resultFields.get("안전·증거 경계").includes(boundary.safety), `${entry.id} safety boundary`);
  }
});

test("audience diagrams register six complete source-linked learning paths", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const diagramManifestPath = path.join(repoRoot, "guides", "assets", "diagram-manifest.json");
  const diagramManifest = JSON.parse(await readFile(diagramManifestPath, "utf8"));
  const { audiencePaths } = await readCommonGuides();
  const audienceDiagrams = diagramManifest.diagrams.filter(({ scope }) => scope === "use-case-audience");

  assert.equal(audienceDiagrams.length, 6, "audience diagram count");
  assert.deepEqual(audienceDiagrams.map(({ id }) => id).sort(), [
    "aud-01",
    "aud-02",
    "aud-03",
    "aud-04",
    "aud-05",
    "aud-06",
  ]);

  for (const audience of manifest.audience_paths) {
    const diagramId = audience.id.toLowerCase();
    const diagram = audienceDiagrams.find(({ id }) => id === diagramId);
    assert.ok(diagram, `${audience.id} diagram registration`);
    assert.equal(diagram.svg, audience.diagram.svg.replace(/^guides\/assets\//, ""), `${audience.id} SVG path`);
    assert.equal(diagram.png, audience.diagram.png.replace(/^guides\/assets\//, ""), `${audience.id} PNG path`);
    assert.deepEqual(diagram.sources, ["../use-cases/audience-paths.md"], `${audience.id} source`);
    assert.deepEqual(diagram.usedBy, ["../use-cases/audience-paths.md"], `${audience.id} consumer`);
    assert.equal(diagram.alt, audience.diagram.alt, `${audience.id} use-case alt`);

    const route = markdownSections(audiencePaths, 2).find(({ heading }) => heading.startsWith(audience.id));
    assert.ok(route, `${audience.id} Markdown route`);
    const embed = new RegExp(
      `\\[!\\[${diagram.alt.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\]\\(\\.\\./assets/use-cases/audiences/${diagramId}\\.png\\)\\]\\(\\.\\./assets/use-cases/audiences/${diagramId}\\.svg\\)`,
      "u",
    );
    const embeds = route.body.match(new RegExp(embed.source, "gu")) ?? [];
    assert.equal(embeds.length, 1, `${audience.id} exactly one editable SVG-wrapped PNG embed`);

    const svgPath = path.join(repoRoot, audience.diagram.svg);
    const pngPath = path.join(repoRoot, audience.diagram.png);
    const svg = await readFile(svgPath, "utf8");
    assert.match(svg, /^<svg\b[^>]*>\s*<title>[^<\s][\s\S]*?<\/title>\s*<desc>[^<\s][\s\S]*?<\/desc>/u, `${audience.id} SVG title and desc`);
    assert.deepEqual(parseViewBox(svg), { w: 1400, h: 900 }, `${audience.id} SVG dimensions`);
    assert.ok(isCompletePng(pngPath), `${audience.id} PNG completion`);
    assert.deepEqual(pngDims(pngPath), { w: 2800, h: 1800 }, `${audience.id} PNG dimensions`);
  }
});

test("output catalog keeps exact H2 result levels and request-table routing", async () => {
  const { outputCatalog } = await readCommonGuides();
  assert.deepEqual(
    markdownSections(outputCatalog, 2).slice(0, 3).map(({ heading }) => heading),
    ["최소 결과", "선택 결과", "확장 결과"],
  );
  assert.deepEqual(tableHeadings(outputCatalog, "Studio 요청과 결과"), OUTPUT_TABLE_HEADINGS);
  assert.deepEqual(tableHeadings(outputCatalog, "Career 요청과 결과"), OUTPUT_TABLE_HEADINGS);
});

test("output catalog separates artifact-relative minimum files from their domain content", async () => {
  const { outputCatalog } = await readCommonGuides();
  for (const section of ["Studio 요청과 결과", "Career 요청과 결과"]) {
    for (const row of tableRows(outputCatalog, section)) {
      assert.match(row["최소 파일 경로"], /`content\.md`/, `${section} content root`);
      assert.doesNotMatch(row["최소 파일 경로"], /문제|규칙|가정|관찰|개인 기여|review findings/u, `${section} path-only minimum files`);
      assert.match(row["내용 범위"], /`content\.md` 내/u, `${section} content description`);
    }
  }
});

test("output catalog preserves canonical reading order and renderer quality boundary", async () => {
  const { outputCatalog } = await readCommonGuides();
  const readingOrder = sectionByHeading(outputCatalog, 2, "Canonical Artifact 읽는 순서");
  const codeBlock = /```text\n([\s\S]*?)\n```/.exec(readingOrder);

  assert.ok(codeBlock, "canonical reading order text block");
  assert.deepEqual(codeBlock[1].split("\n"), [
    "content.md",
    "→ evidence.yml",
    "→ decisions/",
    "→ assets/",
    "→ export-manifest.yml",
  ]);
  assert.match(sectionByHeading(outputCatalog, 2, "최소 결과"), /renderer/);
  assert.match(sectionByHeading(outputCatalog, 2, "선택 결과"), /`concept-draft`/);
  assert.match(
    sectionByHeading(outputCatalog, 2, "확장 결과"),
    /PDF·DOCX·PPTX.*downstream renderer.*format\/visual QA/,
  );
  assert.match(readingOrder, /MD.*renderer 부재/);
});

test("Studio to Career handoff transfers public evidence only and excludes unsafe material", async () => {
  const { outputCatalog } = await readCommonGuides();
  const handoff = sectionByHeading(outputCatalog, 2, "Studio → Career handoff");
  const exclusions = handoff.split("\n").filter((line) => line.startsWith("- "));

  assert.match(handoff, /Studio Canonical Artifact와 Career Canonical Artifact는 분리/);
  assert.match(handoff, /공개 가능한.*문제.*결정.*검증 evidence/);
  assert.ok(exclusions.some((line) => /NDA/.test(line)), "excludes NDA material");
  assert.ok(exclusions.some((line) => /팀 PII/.test(line)), "excludes team PII");
  assert.ok(exclusions.some((line) => /소유권.*확인되지 않은/.test(line)), "excludes rights-unknown assets");
  assert.ok(exclusions.some((line) => /확인되지 않은 팀 성과/.test(line)), "excludes unverified team outcomes");
});

test("use-case manifest rejects duplicate IDs and traversal diagram paths", async (t) => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "use-case-manifest-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await mkdir(path.join(fixtureRoot, "guides", "use-cases"), { recursive: true });
  await writeFile(path.join(fixtureRoot, "guides", "use-cases", "use-case-manifest.json"), JSON.stringify({
    version: 1,
    audience_paths: [
      {
        id: "AUD-01",
        slug: "game-design-student",
        document: "guides/use-cases/audience-paths.md",
        anchor: "aud-01",
        level: "foundation",
        recommended_views: [],
        outputs: [],
        diagram: { svg: "../../escape.svg", png: "guides/assets/aud-01.png", alt: "Audience path" },
      },
      {
        id: "AUD-01",
        slug: "job-seeking-student",
        document: "guides/use-cases/audience-paths.md",
        anchor: "aud-02",
        level: "foundation",
        recommended_views: [],
        outputs: [],
        diagram: { svg: "guides/assets/aud-02.svg", png: "guides/assets/aud-02.png", alt: "Audience path" },
      },
    ],
    cases: [],
    skill_cases: [],
  }, null, 2));

  const { validateUseCaseGuides } = await import("../../tooling/lib/use-case-guides.mjs");
  const result = await validateUseCaseGuides({ repoRoot: fixtureRoot });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("duplicate id: AUD-01")));
  assert.ok(result.errors.some((error) => error.includes("unsafe path: ../../escape.svg")));
});

test("use-case manifest reports malformed case skills with injected inventories", async (t) => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "use-case-manifest-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await mkdir(path.join(fixtureRoot, "guides", "use-cases"), { recursive: true });
  await writeFile(path.join(fixtureRoot, "guides", "use-cases", "use-case-manifest.json"), JSON.stringify({
    version: 1,
    audience_paths: [],
    cases: [{
      id: "ST-C01",
      product: "game-design-studio",
      view: "competency",
      audiences: ["AUD-01"],
      level: ["foundation"],
      document: "guides/game-design-studio/use-cases/competency-paths.md",
      anchor: "st-c01",
      templates: [],
      outputs: [],
      diagram: { svg: "guides/assets/st-c01.svg", png: "guides/assets/st-c01.png", alt: "Studio case" },
    }],
    skill_cases: [],
  }, null, 2));

  const { validateUseCaseGuides } = await import("../../tooling/lib/use-case-guides.mjs");
  const result = await validateUseCaseGuides({
    repoRoot: fixtureRoot,
    inventories: new Map([["game-design-studio", { skillIds: [], templateIds: [] }]]),
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("cases[0].skills must be an array")));
});

test("complete validation rejects missing, directory, and symlink manifest targets while partial declaration defers them", async (t) => {
  for (const targetKind of ["missing", "directory", "symlink"]) {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "use-case-targets-"));
    t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
    const guidesRoot = path.join(fixtureRoot, "guides");
    const document = "guides/use-cases/audience-paths.md";
    const svg = "guides/assets/aud-01.svg";
    const png = "guides/assets/aud-01.png";
    await mkdir(path.join(guidesRoot, "use-cases"), { recursive: true });
    await mkdir(path.join(guidesRoot, "assets"), { recursive: true });
    await writeFile(path.join(fixtureRoot, "guides", "use-cases", "use-case-manifest.json"), JSON.stringify({
      version: 1,
      audience_paths: [{
        id: "AUD-01",
        slug: "test",
        document,
        anchor: "aud-01",
        level: "foundation",
        recommended_views: [],
        outputs: [],
        diagram: { svg, png, alt: "Audience path" },
      }],
      cases: [],
      skill_cases: [],
    }));
    await writeFile(path.join(fixtureRoot, svg), "<svg/>");
    await writeFile(path.join(fixtureRoot, png), "png");
    const documentPath = path.join(fixtureRoot, document);
    if (targetKind === "directory") await mkdir(documentPath);
    if (targetKind === "symlink") {
      const external = path.join(await mkdtemp(path.join(os.tmpdir(), "use-case-target-external-")), "audience-paths.md");
      t.after(() => rm(path.dirname(external), { recursive: true, force: true }));
      await writeFile(external, "# external\n");
      await symlink(external, documentPath);
    }

    const partial = await validateUseCaseGuides({ repoRoot: fixtureRoot });
    assert.equal(partial.ok, true, `${targetKind} partial declaration`);
    assert.equal(partial.targetValidation, "deferred", `${targetKind} target phase`);
    assert.deepEqual(partial.deferredTargetPaths, [document, svg, png], `${targetKind} deferred targets`);

    const complete = await validateUseCaseGuides({ repoRoot: fixtureRoot, requireComplete: true });
    assert.equal(complete.ok, false, `${targetKind} complete validation`);
    const expectedFailure = targetKind === "missing" ? "ENOENT" : targetKind === "directory" ? "expected regular file" : "symlink";
    assert.ok(complete.errors.some((error) => error.includes("audience_paths[0].document") && error.includes(expectedFailure)), `${targetKind} target error`);
  }
});
