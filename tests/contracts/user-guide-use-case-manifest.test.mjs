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
import { collectHeadingAnchors, collectProductInventory, extractMarkdownLinks } from "../../tooling/lib/user-guides.mjs";
import { buildUseCaseDiagrams } from "../../tooling/build-use-case-diagrams.mjs";
import { validateDiagramSource } from "../../tooling/lib/use-case-diagrams.mjs";
import {
  STUDIO_CANONICAL_ROUTE_ARRAY_POLICY,
  STUDIO_CANONICAL_ROUTE_PRODUCTION_CONTRACT,
  STUDIO_DIAGRAM_PRODUCTION_CONTRACT,
  validateStudioDiagramProductionBatch,
  validateStudioDiagramProductionContract,
} from "../../tooling/lib/studio-diagram-production-contract.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const FAQ_ANSWER_FIELDS = [
  "결론",
  "이유와 경계",
  "지금 실행할 요청문",
  "예상 결과물",
  "관련 가이드",
  "권리·근거·승인",
];
const STUDIO_FAQ_ANSWER_FIELDS = [
  "결론",
  "이유와 경계",
  "실행 요청",
  "예상 결과",
  "관련 사례·스킬·템플릿",
  "안전·근거·승인",
];
const STUDIO_FAQ_CONTRACT = Object.freeze([
  ["규칙, mechanic, system과 core loop는 어떻게 다른가?", ["규칙", "mechanic", "system", "core loop"], ["입력", "상태", "루프"], ["rule", "state"], ["ST-C02", "ST-C03", "`core-motivation-loop`"], ["사람", "검토"]],
  ["처음부터 긴 GDD를 만들어야 하는가?", ["긴 GDD", "처음", "없으며"], ["비전", "가정", "경계"], ["vision", "content.md"], ["ST-C01", "`game-design-brief`", "`vision-pillars`"], ["승인", "가정"]],
  ["장르 관습과 핵심 재미를 어떻게 구분하는가?", ["장르 관습", "핵심 재미"], ["플레이어", "반례", "검증"], ["player promise", "validation"], ["ST-C01", "ST-C02", "`vision-pillars`"], ["근거", "자동 승인"]],
  ["상태·예외·변수와 데이터 표는 언제 필요한가?", ["상태", "예외", "데이터 표"], ["precedence", "authority", "runtime mapping"], ["state", "data"], ["ST-C03", "`system-specification`", "`data-schema-table-contract`"], ["engineering", "승인"]],
  ["캐릭터, 스킬, 전투와 monster spec을 어떻게 연결하는가?", ["캐릭터", "스킬", "전투", "monster"], ["entity ID", "cooldown", "prototype"], ["combat", "content.md"], ["ST-C06", "`character-skill-combat-monster`", "`system-specification`"], ["prototype", "사람"]],
  ["UX flow, feedback와 접근성을 어떻게 함께 검토하는가?", ["UX flow", "feedback", "접근성"], ["focus", "오류", "대체 입력"], ["flow", "accessibility"], ["ST-C04", "`ui-ux-flow-state`", "`accessibility-platform-matrix`"], ["accessibility owner", "승인"]],
  ["경제·밸런스 수치를 어떤 근거 없이 만들지 않으려면 어떻게 하는가?", ["경제", "밸런스", "수치"], ["source/sink", "실제 가격", "synthetic data"], ["economy", "evidence"], ["ST-C07", "`economy-balance`", "`liveops-experiment-event`"], ["실제 가격", "승인"]],
  ["LiveOps experiment에서 guardrail과 rollback은 왜 필요한가?", ["guardrail", "rollback"], ["성공 지표", "control", "한 변수"], ["experiment", "rollback"], ["ST-C07", "`liveops-experiment-event`", "`economy-balance`"], ["정책", "승인"]],
  ["AI가 재미를 검증할 수 있는가?", ["AI", "재미", "검증"], ["관찰", "playtest", "가설"], ["playtest", "evidence"], ["ST-C02", "ST-C08", "`core-motivation-loop`"], ["사람", "자동 승인"]],
  ["prototype과 playtest 결과를 문서에 어떻게 반영하는가?", ["prototype", "playtest", "문서"], ["관찰 원문", "가정", "decision ID"], ["evidence.yml", "decision"], ["ST-C01", "ST-C06", "`decision-change-log`"], ["출처", "승인"]],
  ["범위가 너무 큰 기획을 어떻게 줄이는가?", ["범위", "줄"], ["의존성", "capacity", "kill criteria"], ["scope", "prototype"], ["ST-C08", "`production-scope-risk`", "`game-design-brief`"], ["owner", "승인"]],
  ["이미지와 도식을 실제 게임 resource로 사용해도 되는가?", ["이미지", "도식", "resource"], ["Skillstead", "illustration", "prompt-only"], ["asset", "receipt"], ["ST-C08", "`plan-image-assets`", "`image-assets-manifest`"], ["권리", "승인"]],
  ["GDD와 PPTX는 같은 내용을 그대로 나누면 되는가?", ["GDD", "PPTX", "그대로"], ["GDD", "traceable", "PPTX"], ["MD", "PPTX"], ["ST-C08", "`export-game-design-documents`", "`export-preparation-manifest`"], ["renderer", "승인"]],
  ["기존 기획서를 review skill만으로 검토할 수 있는가?", ["기존 기획서", "review skill"], ["stable source", "section", "minimal fix"], ["review", "finding"], ["ST-C03", "ST-C08", "`game-design-review`"], ["근거", "결정"]],
  ["팀에 전달할 때 어떤 결정과 미해결 위험을 남기는가?", ["팀", "결정", "미해결 위험"], ["handoff", "content.md", "공개 가능한"], ["decisions", "risk"], ["ST-C08", "`decision-change-log`", "`game-design-review`"], ["NDA", "승인"]],
  ["renderer가 없을 때 어떤 결과를 전달할 수 있는가?", ["renderer", "Canonical Artifact", "unavailable"], ["capability", "lint", "SVG source"], ["content.md", "SVG"], ["ST-C08", "`visualize-game-design`", "`export-game-design-documents`"], ["PNG", "승인"]],
  ["학생 과제에서 결과를 그대로 제출해도 되는가?", ["학생 과제", "그대로", "제출"], ["답안 대행", "AI 정책", "출처 표기"], ["contribution", "evidence"], ["ST-C01", "ST-C08", "`game-design-review`"], ["학교 정책", "승인"]],
  ["서로 다른 장르 사례를 내 아이디어에 어떻게 적용하는가?", ["서로 다른 장르", "아이디어", "적용"], ["player context", "입력 장치", "사회적 위험"], ["assumption", "validation"], ["ST-G01", "ST-G10", "`game-design-brief`"], ["일반화", "사람"]],
].map(([question, conclusion, reason, result, related, safety], index) => ({
  heading: `Q${String(index + 1).padStart(2, "0")}. ${question}`,
  conclusion,
  reason,
  result,
  related,
  safety,
})));
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
const CAREER_COMPETENCY_HEADINGS = Object.freeze({
  "CA-C01": "CA-C01 기획 직무와 전문 분야 탐색",
  "CA-C02": "CA-C02 게임 분석 언어와 관찰·추론 분리",
  "CA-C03": "CA-C03 현재 채용공고 조사",
  "CA-C04": "CA-C04 역량 격차와 학습·증거 계획",
  "CA-C05": "CA-C05 관찰 기반 역기획",
  "CA-C06": "CA-C06 창작 기획 포트폴리오",
  "CA-C07": "CA-C07 포트폴리오 검토·수정·발표",
  "CA-C08": "CA-C08 면접·주니어 성장·직무 전환",
});
const CAREER_COMPETENCY_SEMANTIC_CONTRACT = Object.freeze({
  "CA-C01": [
    ["역할", "provisional path"], ["합격 가능성"], ["역할 후보", "학습 제약"], ["현재 evidence", "proof task"], ["career-stage-goal", "learning-roadmap"], ["Studio 원본", "병합하지 않"], ["후보자 순위", "proof task"], ["artifact=game-design-career/role-map"], ["career strategist", "멘토"], ["game-design-role-map", "learning-roadmap"], ["사용자와 멘토"], ["**보존:**", "role map"], ["CA-C02", "CA-C03"],
  ],
  "CA-C02": [
    ["직접 본 장면", "해석"], ["내부 구현", "복제"], ["공개 build", "권리"], ["의도일 수 있다", "추론"], ["game-analysis-report", "five-axis-review"], ["기각한 해석", "재관찰"], ["내부 의도", "추정하지 마"], ["artifact=game-design-career/analysis"], ["reviewer", "사람이 결정"], ["game-analysis-report", "reverse-design-document"], ["작성자와 멘토"], ["**보존:**", "location"], ["CA-C03", "CA-C04"],
  ],
  "CA-C03": [
    ["current requirement", "시장 전체"], ["convenience sample", "채용량"], ["retrievalDate", "region"], ["표본 하나", "required와 preferred"], ["반복 신호", "새 source ID"], ["fit·채용 결과", "판정하지 않"], ["sourceUrl", "일반화하지 마"], ["role=systems-designer", "retrievalDate=<date>"], ["evidence auditor", "Research Owner"], ["job-posting-evidence", "source ID별"], ["Research Owner", "Portfolio Reviewer"], ["**보존:**", "historical record"], ["CA-C04", "학습 과제"],
  ],
  "CA-C04": [
    ["학습 가설", "evidence task"], ["경험을 지어 내", "약속"], ["evidence ID", "표본 경계"], ["작은 proof", "검토 날짜"], ["competency-matrix", "learning-roadmap"], ["기각한 대안", "개인과 팀"], ["경력 단계", "재검토 조건"], ["artifact=game-design-career/learning-roadmap"], ["visualize-career-roadmap", "export-career-documents"], ["competency-matrix", "learning-roadmap"], ["작성자와 멘토"], ["**보존:**", "matrix 행"], ["CA-C05", "CA-C06"],
  ],
  "CA-C05": [
    ["evidence ID", "추론"], ["내부 코드", "권리 불명"], ["evidence ID", "개인 기여"], ["EVID-RD-01", "proposal"], ["반례", "public-rights review"], ["Studio 작업", "병합하지 않"], ["EVID-RD-01", "public-rights review"], ["artifact=game-design-career/reverse-design"], ["reverse-engineer-game-design", "public-rights reviewer"], ["reverse-design-document", "EVID-RD-01"], ["public-rights reviewer", "보장하지 않"], ["**보존:**", "review finding"], ["CA-C06", "창작 설계"],
  ],
  "CA-C06": [
    ["evidence ID", "개인 기여"], ["팀 결과", "권한 없는 asset"], ["evidence ID", "public-rights review owner"], ["EVID-CP-01", "prototype"], ["creative-design-portfolio", "five-axis-review"], ["evidence summary", "병합하지 않"], ["EVID-CP-01", "성과·채용"], ["artifact=game-design-career/creative-case"], ["portfolio reviewer", "public-rights reviewer"], ["creative-design-portfolio", "EVID-CP-01"], ["public-rights reviewer", "보장하지 않"], ["**보존:**", "공개 제외 목록"], ["CA-C07", "수정 우선순위"],
  ],
  "CA-C07": [
    ["evidence ID", "발표 답변"], ["자동 승인", "성과·합격"], ["evidence ID", "개인 기여"], ["EVID-PR-01", "가장 작은 수정"], ["five-axis-review", "portfolio-backlog"], ["Studio 원본", "팀 성과"], ["EVID-PR-01", "채용 결과"], ["artifact=game-design-career/portfolio-review"], ["practice-game-design-interview", "export-career-documents"], ["introduction-motivation", "EVID-PR-01"], ["portfolio reviewer", "보장하지 않"], ["**보존:**", "review history"], ["CA-C08", "honest gap"],
  ],
  "CA-C08": [
    ["준비도", "확정 사실"], ["승진", "이직 성공"], ["evidence ID", "feedback owner"], ["EVID-GR-01", "honest gap"], ["interview-question-answer-log", "transition-readiness"], ["evidence summary", "Career Artifact"], ["EVID-GR-01", "채용·승진·전환"], ["artifact=game-design-career/growth-transition"], ["plan-junior-growth", "public-rights reviewer"], ["junior-growth-review", "EVID-GR-01"], ["멘토·manager·career reviewer", "보장하지 않"], ["**보존:**", "재검색·재검토"], ["CA-C03", "CA-C04"],
  ],
});
const CAREER_RESUME_CONTRACT = Object.freeze({
  "CA-C01": ["role evidence가 없으면", "기존 role map", "사용자와 멘토가 role evidence 또는 과제 기록을 확인", "관찰 또는 짧은 과제로 재개"],
  "CA-C02": ["location 또는 권리가 불명확하면", "관찰 기록, evidence ID", "작성자와 멘토가 공개 location 또는 권리를 확인", "보존한 관찰에서 재개"],
  "CA-C03": ["공식 source가 없거나", "기존 source ID", "Research Owner와 Portfolio Reviewer가 보존 기록과 재검색 범위를 확인", "공식 source를 재검색", "새 source ID 또는 evidence ID와 freshness를 확인", "current conclusion을 재개"],
  "CA-C04": ["evidence가 비어 있으면", "evidence ID, matrix 행", "작성자와 멘토가 작은 관찰 과제를 확인", "작은 관찰 과제로 되돌아갑니다"],
  "CA-C05": ["source location·권리·개인 기여 중 하나라도 불명확하면", "EVID-RD-01", "public-rights reviewer가 source location, 권리와 개인 기여를 확인", "확인된 범위에서 재개"],
  "CA-C06": ["개인 기여 또는 권리가 확인되지 않으면", "EVID-CP-01", "portfolio reviewer와 public-rights reviewer가 개인 기여와 권리를 확인", "public-rights review가 끝난 범위에서 재개"],
  "CA-C07": ["evidence가 claim을 지지하지 않으면", "EVID-PR-01", "portfolio reviewer와 멘토가 claim과 evidence를 확인", "backlog로 되돌립니다"],
  "CA-C08": ["fresh requirement, 개인 기여 또는 권리 확인이 없으면", "EVID-GR-01", "멘토·manager·career reviewer와 public-rights reviewer가 보존 기록과 재검색·재검토 범위를 확인", "requirement를 재검색하고 evidence를 갱신", "fresh requirement와 새 evidence ID, 개인 기여와 권리를 확인", "다음 proof task를 재개"],
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
const STUDIO_NUMERIC_CLAIM_CASES = Object.freeze([
  ["reject", "retention은 40%입니다."],
  ["reject", "시장성은 80%입니다."],
  ["reject", "시장 규모는 1조 원입니다."],
  ["reject", "KPI는 70%입니다."],
  ["reject", "재미는 90점입니다."],
  ["reject", "밸런스는 95점입니다."],
  ["reject", "학습 효과는 60%입니다."],
  ["reject", "70% retention은 이미 달성된 사실입니다."],
  ["reject", "KPI는 근거 없이 70%로 확정됩니다."],
  ["reject", "시장 규모는 검증 없이 1조 원으로 확정되었습니다."],
  ["reject", "KPI 70%는 prototype 없이 제시합니다."],
  ["reject", "재미 90점은 telemetry 없이는 제시됩니다."],
  ["reject", "밸런스 95점은 simulation 없이 제시합니다."],
  ["reject", "학습 효과 60%는 사람 검토 없이는 제시됩니다."],
  ["reject", "시장성 80%는 사람 결정 없이 제시합니다."],
  ["reject", "KPI 70%는 사람 평가 없이는 제시됩니다."],
  ["reject", "재미 90점은 가정 없이 제시합니다."],
  ["reject", "밸런스 95점은 관찰 없이는 제시됩니다."],
  ["reject", "학습 효과 60%는 평가 없이 제시합니다."],
  ["reject", "KPI 70%는 정답이 아니라 확정된 결과입니다."],
  ["reject", "KPI 70%의 무단 공개는 금지하지만 달성은 확정됩니다."],
  ["reject", "KPI 70% 달성 보장은 금지하며, telemetry 없이 제시합니다."],
  ["reject", "retention 40%는 확정이 아니라 제시합니다."],
  ["reject", "KPI 70%는 prototype과 telemetry 없이 제시합니다."],
  ["reject", "KPI 70%는 사람 검토와 결정 없이 제시합니다."],
  ["reject", "KPI 70%는 근거 없이 제시하고, 재미 90점은 telemetry로 검증합니다."],
  ["allow", "retention은 40%라는 가정이며 prototype과 telemetry로 검증합니다."],
  ["allow", "시장성은 80%라는 가정이며 사람 검토로 검증합니다."],
  ["allow", "시장 규모는 1조 원이라는 가정이며 simulation 근거로 검증합니다."],
  ["allow", "retention 40%라는 가정은 검증 전 정답이 아닙니다."],
  ["allow", "KPI 70%는 prototype으로 검증할 가정입니다."],
  ["allow", "재미 90점은 telemetry로 검증할 가정입니다."],
  ["allow", "밸런스 95점은 simulation으로 검증할 가정입니다."],
  ["allow", "학습 효과 60%는 사람 평가로 검증할 가정입니다."],
  ["allow", "retention 40%는 확정이 아니라 prototype으로 검증할 가정입니다."],
  ["allow", "KPI 70% 달성 보장은 금지하며, telemetry로 검증할 가정입니다."],
]);
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
    ["`ST-C02`", "`ST-C03`"],
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
const CAREER_CASE_CONTRACT = Object.freeze([
  ["CA-C01", "competency", "ca-c01-기획-직무와-전문-분야-탐색", ["AUD-01", "AUD-02", "AUD-03", "AUD-06"], ["foundation", "applied"], ["apply-document-quality-profile", "map-game-design-career", "research-game-design-jobs"], ["career-stage-goal", "game-design-role-map", "learning-roadmap"], ["game-design-role-map", "learning-roadmap"], "기획 직무와 전문 분야를 비교하는 흐름"],
  ["CA-C02", "competency", "ca-c02-게임-분석-언어와-관찰추론-분리", ["AUD-01", "AUD-02", "AUD-03", "AUD-04", "AUD-06"], ["foundation", "applied"], ["apply-document-quality-profile", "reverse-engineer-game-design", "review-game-design-portfolio"], ["game-analysis-report", "reverse-design-document", "five-axis-review"], ["game-analysis-report", "reverse-design-document"], "게임 분석의 관찰과 추론을 분리하는 흐름"],
  ["CA-C03", "competency", "ca-c03-현재-채용공고-조사", ["AUD-02", "AUD-03", "AUD-05", "AUD-06"], ["applied", "advanced"], ["research-game-design-jobs", "map-game-design-career", "apply-document-quality-profile"], ["job-posting-evidence", "game-design-role-map", "competency-matrix"], ["job-posting-evidence", "game-design-role-map"], "현재 채용공고의 근거와 표본 경계를 기록하는 흐름"],
  ["CA-C04", "competency", "ca-c04-역량-격차와-학습증거-계획", ["AUD-01", "AUD-02", "AUD-03", "AUD-05", "AUD-06"], ["foundation", "applied", "advanced"], ["apply-document-quality-profile", "map-game-design-career", "visualize-career-roadmap", "export-career-documents"], ["competency-matrix", "learning-roadmap", "career-stage-goal"], ["competency-matrix", "learning-roadmap"], "역량 격차를 학습과 증거 과제로 전환하는 흐름"],
  ["CA-C05", "competency", "ca-c05-관찰-기반-역기획", ["AUD-01", "AUD-02", "AUD-03", "AUD-04", "AUD-05"], ["foundation", "applied", "advanced"], ["apply-document-quality-profile", "reverse-engineer-game-design", "export-career-documents"], ["reverse-design-document", "game-analysis-report"], ["reverse-design-document", "game-analysis-report"], "관찰과 추론 및 반례를 기록하는 역기획 흐름"],
  ["CA-C06", "competency", "ca-c06-창작-기획-포트폴리오", ["AUD-02", "AUD-03", "AUD-04", "AUD-05", "AUD-06"], ["applied", "advanced"], ["apply-document-quality-profile", "build-game-design-portfolio", "review-game-design-portfolio"], ["portfolio-project-brief", "creative-design-portfolio", "five-axis-review"], ["portfolio-project-brief", "creative-design-portfolio"], "창작 기획의 판단과 근거를 포트폴리오로 연결하는 흐름"],
  ["CA-C07", "competency", "ca-c07-포트폴리오-검토수정발표", ["AUD-02", "AUD-03", "AUD-05", "AUD-06"], ["applied", "advanced"], ["review-game-design-portfolio", "build-game-design-portfolio", "practice-game-design-interview", "export-career-documents"], ["five-axis-review", "portfolio-backlog", "introduction-motivation"], ["five-axis-review", "portfolio-backlog", "introduction-motivation"], "포트폴리오 검토와 수정 및 발표 준비 흐름"],
  ["CA-C08", "competency", "ca-c08-면접주니어-성장직무-전환", ["AUD-03", "AUD-05", "AUD-06"], ["applied", "advanced"], ["practice-game-design-interview", "plan-junior-growth", "visualize-career-roadmap", "export-career-documents"], ["interview-question-answer-log", "junior-growth-review", "transition-readiness"], ["interview-question-answer-log", "junior-growth-review", "transition-readiness"], "면접과 주니어 성장 및 직무 전환의 증거 흐름"],
  ["CA-T01", "target", "ca-t01-시스템-기획-입문-학생", ["AUD-01", "AUD-02"], ["foundation", "applied"], ["map-game-design-career", "build-game-design-portfolio", "plan-junior-growth"], ["game-design-role-map", "competency-matrix", "learning-roadmap"], ["game-design-role-map", "competency-matrix", "learning-roadmap"], "시스템 기획 입문 학생의 증거 과제와 학습 경로"],
  ["CA-T02", "target", "ca-t02-콘텐츠퀘스트-기획-준비생", ["AUD-01", "AUD-02"], ["foundation", "applied"], ["map-game-design-career", "build-game-design-portfolio", "review-game-design-portfolio"], ["game-design-role-map", "portfolio-project-brief", "creative-design-portfolio"], ["game-design-role-map", "portfolio-project-brief", "creative-design-portfolio"], "콘텐츠와 퀘스트 기획 준비생의 제작 가능성 증거 흐름"],
  ["CA-T03", "target", "ca-t03-전투캐릭터-기획-준비생", ["AUD-01", "AUD-02"], ["foundation", "applied"], ["reverse-engineer-game-design", "build-game-design-portfolio", "review-game-design-portfolio"], ["game-analysis-report", "portfolio-project-brief", "creative-design-portfolio"], ["game-analysis-report", "portfolio-project-brief", "creative-design-portfolio"], "전투와 캐릭터 기획 준비생의 분석과 검증 흐름"],
  ["CA-T04", "target", "ca-t04-경제밸런스liveops-준비생", ["AUD-01", "AUD-02"], ["foundation", "applied"], ["reverse-engineer-game-design", "build-game-design-portfolio", "review-game-design-portfolio"], ["game-analysis-report", "portfolio-project-brief", "five-axis-review"], ["game-analysis-report", "portfolio-project-brief", "five-axis-review"], "경제와 밸런스 및 LiveOps 준비생의 가정 검증 흐름"],
  ["CA-T05", "target", "ca-t05-uiux-기획-준비생", ["AUD-01", "AUD-02"], ["foundation", "applied"], ["map-game-design-career", "build-game-design-portfolio", "review-game-design-portfolio"], ["competency-matrix", "portfolio-project-brief", "five-axis-review"], ["competency-matrix", "portfolio-project-brief", "five-axis-review"], "UI UX 기획 준비생의 접근성과 usability 증거 흐름"],
  ["CA-T06", "target", "ca-t06-내러티브-기획-준비생", ["AUD-01", "AUD-02"], ["foundation", "applied"], ["map-game-design-career", "build-game-design-portfolio", "review-game-design-portfolio"], ["game-design-role-map", "portfolio-project-brief", "creative-design-portfolio"], ["game-design-role-map", "portfolio-project-brief", "creative-design-portfolio"], "내러티브 기획 준비생의 협업 계약과 증거 흐름"],
  ["CA-T07", "target", "ca-t07-레벨-디자인-준비생", ["AUD-01", "AUD-02"], ["foundation", "applied"], ["reverse-engineer-game-design", "build-game-design-portfolio", "review-game-design-portfolio"], ["game-analysis-report", "portfolio-project-brief", "five-axis-review"], ["game-analysis-report", "portfolio-project-brief", "five-axis-review"], "레벨 디자인 준비생의 공간과 playtest 증거 흐름"],
  ["CA-T08", "target", "ca-t08-실무-경험이-없는-신입", ["AUD-01", "AUD-02", "AUD-03"], ["foundation", "applied"], ["map-game-design-career", "build-game-design-portfolio", "review-game-design-portfolio"], ["career-stage-goal", "portfolio-project-brief", "portfolio-backlog"], ["career-stage-goal", "portfolio-project-brief", "portfolio-backlog"], "실무 경험이 없는 신입의 판단과 반복 개선 증거 흐름"],
  ["CA-T09", "target", "ca-t09-비전공자다른-직군-전환자", ["AUD-03"], ["foundation", "applied"], ["map-game-design-career", "research-game-design-jobs", "build-game-design-portfolio", "plan-junior-growth"], ["transition-readiness", "game-design-role-map", "portfolio-project-brief"], ["transition-readiness", "game-design-role-map", "portfolio-project-brief"], "직군 전환자의 전이 가능한 역량과 새 증거 과제 흐름"],
  ["CA-T10", "target", "ca-t10-주니어의-성장이직", ["AUD-05", "AUD-06"], ["applied", "advanced"], ["plan-junior-growth", "research-game-design-jobs", "practice-game-design-interview", "visualize-career-roadmap", "export-career-documents"], ["junior-growth-review", "transition-readiness", "interview-question-answer-log"], ["junior-growth-review", "transition-readiness", "interview-question-answer-log"], "주니어의 성장과 이직 준비도 증거 흐름"],
].map(([id, view, anchor, audiences, level, skills, templates, outputs, alt]) => ({
  id,
  product: "game-design-career",
  view,
  document: `guides/game-design-career/use-cases/${view === "competency" ? "competency-paths" : "concept-scenarios"}.md`,
  anchor,
  audiences,
  level,
  skills,
  templates,
  outputs,
  diagram: {
    svg: `guides/assets/game-design-career/use-cases/${id.toLowerCase()}.svg`,
    png: `guides/assets/game-design-career/use-cases/${id.toLowerCase()}.png`,
    alt,
  },
})));
const CAREER_SKILL_CASE_CONTRACT = Object.freeze([
  ["CA-S01", "apply-document-quality-profile", "career-직접-호출-활용-apply-document-quality-profile", ["selection-record", "quality-checklist", "requirement-manifest"], ["map-game-design-career", "research-game-design-jobs", "build-game-design-portfolio", "reverse-engineer-game-design", "practice-game-design-interview", "review-game-design-portfolio", "plan-junior-growth", "visualize-career-roadmap", "export-career-documents", "plan-image-assets"], "Career 문서 품질 프로필 직접 호출 흐름"],
  ["CA-S02", "build-game-design-portfolio", "직접-호출-활용-build-game-design-portfolio", ["portfolio-project-brief", "creative-design-portfolio"], ["review-game-design-portfolio", "practice-game-design-interview", "export-career-documents"], "게임 기획 포트폴리오 직접 호출 흐름"],
  ["CA-S03", "export-career-documents", "직접-호출-활용-export-career-documents", ["export-preparation-manifest", "format-jobs"], [], "Career 문서 출력 직접 호출 흐름"],
  ["CA-S04", "generate-image-assets", "career-직접-호출-활용-generate-image-assets", ["image-generation-result", "image-generation-provenance"], ["review-image-assets"], "Career 이미지 자산 생성 직접 호출 흐름"],
  ["CA-S05", "map-game-design-career", "직접-호출-활용-map-game-design-career", ["game-design-role-map", "competency-matrix"], ["research-game-design-jobs", "build-game-design-portfolio", "visualize-career-roadmap"], "게임 기획 경로 매핑 직접 호출 흐름"],
  ["CA-S06", "orchestrate-game-design-career", "직접-호출-활용-orchestrate-game-design-career", ["career-stage-goal", "career-stage-brief"], ["map-game-design-career", "research-game-design-jobs", "build-game-design-portfolio", "reverse-engineer-game-design", "practice-game-design-interview", "review-game-design-portfolio", "plan-junior-growth", "visualize-career-roadmap", "export-career-documents"], "게임 기획 커리어 오케스트레이션 직접 호출 흐름"],
  ["CA-S07", "plan-image-assets", "career-직접-호출-활용-plan-image-assets", ["image-assets-manifest", "image-prompts"], ["generate-image-assets", "visualize-career-roadmap"], "Career 이미지 자산 계획 직접 호출 흐름"],
  ["CA-S08", "plan-junior-growth", "직접-호출-활용-plan-junior-growth", ["junior-growth-review", "transition-readiness"], ["visualize-career-roadmap", "export-career-documents"], "주니어 성장 계획 직접 호출 흐름"],
  ["CA-S09", "practice-game-design-interview", "직접-호출-활용-practice-game-design-interview", ["interview-question-answer-log", "honest-answer-patterns"], ["plan-junior-growth", "review-game-design-portfolio"], "게임 기획 면접 연습 직접 호출 흐름"],
  ["CA-S10", "research-game-design-jobs", "직접-호출-활용-research-game-design-jobs", ["job-posting-evidence", "evidence-gap-plan"], ["map-game-design-career", "build-game-design-portfolio", "practice-game-design-interview"], "게임 기획 채용 근거 조사 직접 호출 흐름"],
  ["CA-S11", "reverse-engineer-game-design", "직접-호출-활용-reverse-engineer-game-design", ["reverse-design-document", "game-analysis-report"], ["build-game-design-portfolio", "export-career-documents"], "게임 역기획 직접 호출 흐름"],
  ["CA-S12", "review-game-design-portfolio", "직접-호출-활용-review-game-design-portfolio", ["five-axis-review", "portfolio-backlog"], ["build-game-design-portfolio", "practice-game-design-interview", "export-career-documents"], "게임 기획 포트폴리오 검토 직접 호출 흐름"],
  ["CA-S13", "review-image-assets", "career-직접-호출-활용-review-image-assets", ["image-asset-review", "lifecycle-receipt"], ["export-career-documents"], "Career 이미지 자산 검토 직접 호출 흐름"],
  ["CA-S14", "svg-infographic", "career-직접-호출-활용-svg-infographic", ["editable-svg", "png-2x", "render-evidence"], ["visualize-career-roadmap"], "Career SVG 인포그래픽 직접 호출 흐름"],
  ["CA-S15", "visualize-career-roadmap", "직접-호출-활용-visualize-career-roadmap", ["editable-svg", "png-2x", "visualization-evidence"], ["export-career-documents"], "게임 기획 커리어 로드맵 시각화 직접 호출 흐름"],
].map(([id, skill, anchor, outputs, next_skills, alt]) => ({
  id,
  product: "game-design-career",
  skill,
  document: `guides/game-design-career/skills/${skill}.md`,
  anchor,
  outputs,
  next_skills,
  diagram: {
    svg: `guides/assets/game-design-career/skills/${skill}.svg`,
    png: `guides/assets/game-design-career/skills/${skill}.png`,
    alt,
  },
})));

function projectCareerCase({ id, product, view, document, anchor, audiences, level, skills, templates, outputs, diagram }) {
  return {
    id, product, view, document, anchor, audiences, level, skills, templates, outputs,
    diagram: { svg: diagram.svg, png: diagram.png, alt: diagram.alt },
  };
}

function projectCareerSkillCase({ id, product, skill, document, anchor, outputs, next_skills, diagram }) {
  return {
    id, product, skill, document, anchor, outputs, next_skills,
    diagram: { svg: diagram.svg, png: diagram.png, alt: diagram.alt },
  };
}

function assertCareerManifestMetadata({ cases, skillCases }) {
  assert.deepEqual(cases.map(projectCareerCase), CAREER_CASE_CONTRACT, "all Career case metadata matches the declared coverage contract");
  assert.deepEqual(skillCases.map(projectCareerSkillCase), CAREER_SKILL_CASE_CONTRACT, "all Career direct-use metadata matches the declared coverage contract");
}
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
  const sentences = markdown.split(/(?<=[.!?])\s+|\n+/u).map((sentence) => sentence.trim()).filter(Boolean);
  for (const sentence of sentences) {
    assert.equal(isUnsafeNumericOutcomeSentence(sentence), false, `unsafe numeric outcome claim: ${sentence}`);
  }
}

function isUnsafeNumericOutcomeSentence(sentence) {
  const normalized = sentence.replace(/ST-[CG]\d+/giu, "");
  return numericOutcomeClaimClauses(normalized).some((clause) => isUnsafeNumericOutcomeClause(clause));
}

function numericOutcomeClaimClauses(sentence) {
  const fragments = sentence
    .split(/[,;]|하지만|그러나|반면|이고|이며|하고|하며|\b(?:but|however|and)\b/giu)
    .map((fragment) => fragment.trim())
    .filter(Boolean);
  const clauses = [];
  for (const fragment of fragments) {
    if (hasNumericOutcomePair(fragment)) clauses.push(fragment);
    else if (clauses.length > 0) clauses[clauses.length - 1] += ` ${fragment}`;
  }
  return clauses;
}

function hasNumericOutcomePair(clause) {
  const hasClaim = /retention|리텐션|시장성|시장\s*규모|시장\s*점유율|KPI|재미|밸런스|balance|효과/iu.test(clause);
  const hasNumericValue = /\d+(?:[.,]\d+)?\s*(?:%|점|배|조\s*원|억\s*원|만\s*원|원|명|일|회)?/u.test(clause);
  return hasClaim && hasNumericValue;
}

function isUnsafeNumericOutcomeClause(clause) {
  const assertions = [...clause.matchAll(/보장|확정|정답|달성(?:된|한)?\s*사실/gu)];
  if (assertions.some((assertion) => !isLocallyNegatedAssertion(clause, assertion))) return true;

  const qualifier = String.raw`(?:prototype|telemetry|simulation|사람(?:의)?\s*(?:검토|결정|평가)|검토|결정|가정|검증|관찰|평가|근거)`;
  const negatedQualifierGroup = new RegExp(
    `${qualifier}(?:\\s*(?:과|와|및|또는|\/|·)\\s*${qualifier})*\\s*(?:이|가|은|는|도|조차|마저)?\\s*없(?:이|이는)`,
    "giu",
  );
  const withoutNegatedQualifiers = clause.replace(
    negatedQualifierGroup,
    "",
  );
  const hasPositiveValidation = /prototype|telemetry|simulation|사람(?:의)?\s*(?:검토|결정|평가)|가정|검증|provisional|관찰|평가|근거/iu.test(withoutNegatedQualifiers);
  return !hasPositiveValidation;
}

function isLocallyNegatedAssertion(sentence, assertion) {
  const tail = sentence.slice(assertion.index + assertion[0].length);
  const localClause = tail.split(/[,;]|하지만|그러나|반면|이고|이며/u, 1)[0].slice(0, 32);
  return /^\s*(?:은|는|이|가|을|를)?\s*(?:아닙니다|아니다|아니며|아니라|금지)/u.test(localClause);
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

async function readCareerCompetencyGuides() {
  const useCaseRoot = path.join(repoRoot, "guides", "game-design-career", "use-cases");
  const filenames = {
    index: path.join(useCaseRoot, "README.md"),
    competencyPaths: path.join(useCaseRoot, "competency-paths.md"),
  };
  for (const filename of Object.values(filenames)) {
    const stat = await lstat(filename);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `expected regular file: ${filename}`);
  }
  const [index, competencyPaths] = await Promise.all([
    readFile(filenames.index, "utf8"),
    readFile(filenames.competencyPaths, "utf8"),
  ]);
  return { index, competencyPaths };
}

function sentenceRangeAt(text, index) {
  const previousBoundaries = [text.lastIndexOf(".", index - 1), text.lastIndexOf("!", index - 1), text.lastIndexOf("?", index - 1), text.lastIndexOf("\n", index - 1)];
  const nextBoundaries = [text.indexOf(".", index), text.indexOf("!", index), text.indexOf("?", index), text.indexOf("\n", index)].filter((boundary) => boundary !== -1);
  return {
    start: Math.max(...previousBoundaries) + 1,
    end: nextBoundaries.length > 0 ? Math.min(...nextBoundaries) + 1 : text.length,
  };
}

function assertCareerFailurePredicates({ failure, id, resumeMarkers }) {
  for (const approval of failure.matchAll(/승인/gu)) {
    const afterApproval = failure.slice(approval.index);
    const beforeApproval = failure.slice(Math.max(0, approval.index - 8), approval.index);
    const explicitlyNegative = /^승인하지/u.test(afterApproval)
      || (/자동(?:으로)?\s*$/u.test(beforeApproval) && /^승인(?:을|은)?\s*금지/u.test(afterApproval));
    assert.ok(explicitlyNegative, `${id} rejects approval before verification`);
  }

  const humanGateIndex = failure.indexOf(resumeMarkers[2]);
  const canonicalResumeIndex = failure.indexOf(resumeMarkers.at(-1));
  const canonicalResumeClause = sentenceRangeAt(failure, canonicalResumeIndex);
  for (const continuation of failure.matchAll(/계속|진행|재개/gu)) {
    assert.ok(continuation.index > humanGateIndex, `${id} continuation occurs only after the human gate`);
    assert.ok(
      continuation.index >= canonicalResumeClause.start && continuation.index < canonicalResumeClause.end,
      `${id} continuation occurs only in canonical resume clause`,
    );
  }
}

function assertNegativeEvidencePredicates(clause) {
  for (const predicate of clause.matchAll(/사용|반영/gu)) {
    const predicateTail = clause.slice(predicate.index);
    assert.match(
      predicateTail,
      /^(?:사용|반영)(?:하지\s*(?:않|말|못)|할\s*수\s*없|(?:을|를|은|는)?\s*(?:금지|보류|중단))/u,
      "CA-C03 stale/current clause requires negative boundary",
    );
  }
}

function assertCareerCompetencyStructure({ competencyPaths, entries, inventory }) {
  const h2Sections = markdownSections(competencyPaths, 2);
  const anchors = collectHeadingAnchors(competencyPaths);

  assert.equal(entries.length, 8);
  assert.deepEqual(h2Sections.map(({ heading }) => heading), entries.map(({ id }) => CAREER_COMPETENCY_HEADINGS[id]));
  for (const entry of entries) {
    assert.ok(anchors.has(entry.anchor), `${entry.id} manifest anchor`);
    const caseSection = h2Sections.find(({ heading }) => heading === CAREER_COMPETENCY_HEADINGS[entry.id]);
    assert.ok(caseSection, `${entry.id} H2 section`);
    const caseParts = markdownSections(caseSection.body, 3);
    assert.deepEqual(caseParts.map(({ heading }) => heading), STUDIO_COMPETENCY_CASE_MARKERS, `${entry.id} common case-card shape`);
    for (const part of caseParts) assert.ok(part.body.length > 0, `${entry.id} ${part.heading} content`);
    const byHeading = new Map(caseParts.map((section) => [section.heading, section.body]));
    const flow = byHeading.get("스킬·템플릿 흐름");
    for (const skill of entry.skills) assert.match(flow, new RegExp("`" + skill + "`"), `${entry.id} skill ${skill}`);
    for (const template of entry.templates) assert.match(flow, new RegExp("`" + template + "`"), `${entry.id} template ${template}`);
    const results = byHeading.get("결과물");
    for (const output of entry.outputs) assert.match(results, new RegExp("`" + output + "`"), `${entry.id} output ${output}`);
    assert.match(byHeading.get("검토와 승인"), /\*\*사람 결정:\*\*/);
    assert.match(byHeading.get("검토와 승인"), /자동.*승인(?:을 )?(?:하지 않|이? (?:아니|아닙)|되지는 않)|승인을 대신하지 않/);
  }
  assertCareerCompetencySemantics({ competencyPaths, entries, inventory });
}

function assertCareerCompetencySemantics({ competencyPaths, entries, inventory }) {
  assert.deepEqual(Object.keys(CAREER_COMPETENCY_SEMANTIC_CONTRACT), entries.map(({ id }) => id), "Career semantic expectation coverage");
  for (const entry of entries) {
    const caseBody = sectionByHeading(competencyPaths, 2, CAREER_COMPETENCY_HEADINGS[entry.id]);
    const byHeading = new Map(markdownSections(caseBody, 3).map((section) => [section.heading, section.body]));
    const semanticContract = CAREER_COMPETENCY_SEMANTIC_CONTRACT[entry.id];
    assert.equal(semanticContract.length, STUDIO_COMPETENCY_CASE_MARKERS.length, `${entry.id} semantic section coverage`);
    for (const [index, terms] of semanticContract.entries()) {
      const heading = STUDIO_COMPETENCY_CASE_MARKERS[index];
      const body = byHeading.get(heading);
      assert.ok(body.length >= 40, `${entry.id} ${heading} substantive content`);
      assert.doesNotMatch(body, /^(?:TODO|TBD|예정)(?:\b|$)/iu, `${entry.id} ${heading} placeholder`);
      for (const term of terms) assert.ok(body.includes(term), `${entry.id} ${heading} semantic term: ${term}`);
    }

    const appBlocks = fencedCodeBlocks(byHeading.get("Codex App 요청문"), "text");
    assert.equal(appBlocks.length, 1, `${entry.id} one App request block`);
    assert.match(appBlocks[0], /^@Game Design Career .+$/s, `${entry.id} App request`);
    const cliBlocks = fencedCodeBlocks(byHeading.get("Codex CLI 요청문"), "text");
    assert.equal(cliBlocks.length, 1, `${entry.id} one CLI request block`);
    const commandLines = cliBlocks[0].split("\n").filter((line) => line.trim().length > 0);
    assert.equal(commandLines.length, 1, `${entry.id} one executable CLI command line`);
    const commandMatch = /^\$game-design-career:([a-z0-9-]+)(?:\s|$)/.exec(commandLines[0]);
    assert.ok(commandMatch, `${entry.id} executable CLI command`);
    const skillId = commandMatch[1];
    assert.ok(inventory.skillIds.includes(skillId), `${entry.id} installed Career skill: ${skillId}`);
    assert.ok(entry.skills.includes(skillId), `${entry.id} manifest-bound CLI skill: ${skillId}`);

    const results = byHeading.get("결과물");
    assert.deepEqual(fieldLabels(results), ["최소 결과", "선택 결과", "확장 결과"], `${entry.id} output ownership levels`);
    let previousOutputIndex = -1;
    for (const output of entry.outputs) {
      const outputIndex = results.indexOf("`" + output + "`");
      assert.ok(outputIndex > previousOutputIndex, `${entry.id} manifest output read order: ${output}`);
      previousOutputIndex = outputIndex;
    }
    const review = byHeading.get("검토와 승인");
    assert.match(review, /\*\*사람 결정:\*\*/, `${entry.id} review owner`);
    const outputCheckpoint = `**검토 체크포인트:** ${entry.outputs.map((output) => "`" + output + "`").join(" → ")} 순서로 읽고`;
    assert.ok(review.includes(outputCheckpoint), `${entry.id} section-local output review checkpoint`);
    const failure = byHeading.get("실패·재개");
    assert.match(failure, /\*\*보존:\*\*/, `${entry.id} preserves resumable evidence`);
    const resumeMarkers = CAREER_RESUME_CONTRACT[entry.id];
    const markerIndexes = resumeMarkers.map((marker) => failure.indexOf(marker));
    for (const [index, marker] of resumeMarkers.entries()) assert.notEqual(markerIndexes[index], -1, `${entry.id} failure-resume contract: ${marker}`);
    assert.ok(markerIndexes.every((position, index) => index === 0 || markerIndexes[index - 1] < position), `${entry.id} ordered failure-preserve-gate-resume`);
    assertCareerFailurePredicates({ failure, id: entry.id, resumeMarkers });
  }

  const c03 = sectionByHeading(competencyPaths, 2, CAREER_COMPETENCY_HEADINGS["CA-C03"]);
  const c03Parts = new Map(markdownSections(c03, 3).map((section) => [section.heading, section.body]));
  const practice = c03Parts.get("표준 실습");
  const resume = c03Parts.get("실패·재개");
  for (const field of ["sourceUrl", "location", "retrievalDate", "region", "sample boundary", "reviewAfter"]) {
    assert.match(practice, new RegExp("`" + field + "`"), `CA-C03 standard-practice current evidence ${field}`);
  }
  assert.doesNotMatch(practice, /https?:\/\//, "CA-C03 does not invent example URL");
  assert.match(practice, /`reviewAfter` 이후 재검색 전까지 current claim에 사용하지 않/, "CA-C03 stale current-claim polarity");
  const staleCurrentClauses = practice.split(/(?:[.!?]\s+|\n+)/).filter((clause) => {
    const staleContext = /stale|reviewAfter|오래된 evidence/iu.test(clause);
    const currentContext = /current claim|current conclusion/iu.test(clause);
    const useContext = /사용|반영/u.test(clause);
    return staleContext && currentContext && useContext;
  });
  assert.ok(staleCurrentClauses.length > 0, "CA-C03 stale/current clauses exist");
  for (const clause of staleCurrentClauses) {
    assertNegativeEvidencePredicates(clause);
  }
  assert.match(practice, /새 source ID/, "CA-C03 refresh creates a new source ID");
  assert.match(resume, /`reviewAfter`가 지나면 current conclusion을 보류[\s\S]*보존 기록과 재검색 범위를 확인[\s\S]*공식 source를 재검색[\s\S]*새 source ID 또는 evidence ID와 freshness를 확인[\s\S]*current conclusion을 재개/, "CA-C03 stale conclusion refresh workflow");
}

function assertCareerIndexRouteStrings({ index, allCareerCases, competencyPaths }) {
  const links = extractMarkdownLinks(index).map(({ target }) => target);
  const competencyAnchors = collectHeadingAnchors(competencyPaths);
  const deferredSection = sectionByHeading(index, 2, "대상별 사례 — Task 3 deferred");
  assert.deepEqual(extractMarkdownLinks(deferredSection), [], "Career deferred routes contain no Markdown links");
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const entry of allCareerCases.filter((entry) => entry.view === "competency")) {
    const target = `${entry.document.split("/").pop()}#${entry.anchor}`;
    assert.ok(links.includes(target), `${entry.id} current Markdown link`);
    assert.match(index, new RegExp("\\[" + escapeRegExp(entry.id) + "[^\\]]*\\]\\(" + escapeRegExp(target) + "\\)"), `${entry.id} current Markdown link text`);
    assert.ok(competencyAnchors.has(entry.anchor), `${entry.id} current target anchor exists`);
  }
  for (const entry of allCareerCases.filter((entry) => entry.view === "target")) {
    const target = `${entry.document.split("/").pop()}#${entry.anchor}`;
    assert.ok(!links.includes(target), `${entry.id} deferred route is not Markdown`);
    assert.match(index, new RegExp("\\*\\*" + escapeRegExp(entry.id) + "[^\\n]*\\*\\* — 예정 경로: `" + escapeRegExp(target) + "`"), `${entry.id} deferred plain route`);
  }
  for (const target of ["../../use-cases/README.md#공통-faq", "../../use-cases/output-catalog.md"]) {
    assert.ok(links.includes(target), `Career index actual shared link: ${target}`);
  }
}

function assertStudioFaq(markdown) {
  const headings = [...markdown.matchAll(/^(#{1,3}) (.+)$/gm)].map((match) => ({
    level: match[1].length,
    heading: match[2],
    index: match.index,
    length: match[0].length,
  }));
  const answers = headings
    .map((heading, index) => ({
      ...heading,
      body: markdown.slice(heading.index + heading.length, headings[index + 1]?.index).trim(),
    }))
    .filter(({ level }) => level === 3);
  assert.deepEqual(answers.map(({ heading }) => heading), STUDIO_FAQ_CONTRACT.map(({ heading }) => heading), "Studio FAQ approved question headings");
  for (const [index, answer] of answers.entries()) {
    const contract = STUDIO_FAQ_CONTRACT[index];
    const fields = inlineFields(answer.body);
    assert.deepEqual(inlineFieldLabels(answer.body), STUDIO_FAQ_ANSWER_FIELDS, `${answer.heading} answer shape`);
    const byLabel = new Map(fields.map((field) => [field.label, field.value]));
    for (const field of fields) {
      const minimum = field.label === "결론" ? 24 : 60;
      assert.ok(field.value.length >= minimum, `${answer.heading} ${field.label} substantive content`);
      assert.doesNotMatch(field.value, /^(?:TODO|TBD)(?:\b|$)/iu, `${answer.heading} ${field.label} placeholder`);
    }
    for (const term of contract.conclusion) assert.ok(byLabel.get("결론").includes(term), `${answer.heading} conclusion term: ${term}`);
    for (const term of contract.reason) assert.ok(byLabel.get("이유와 경계").includes(term), `${answer.heading} reason term: ${term}`);
    for (const term of contract.result) assert.ok(byLabel.get("예상 결과").includes(term), `${answer.heading} result term: ${term}`);
    for (const term of contract.related) assert.ok(byLabel.get("관련 사례·스킬·템플릿").includes(term), `${answer.heading} related term: ${term}`);
    for (const term of contract.safety) assert.ok(byLabel.get("안전·근거·승인").includes(term), `${answer.heading} safety term: ${term}`);

    const request = byLabel.get("실행 요청");
    const requestBlocks = fencedCodeBlocks(request, "text");
    assert.equal(requestBlocks.length, 1, `${answer.heading} one executable request block`);
    assert.match(requestBlocks[0], /^(?:@Game Design Studio|\$game-design-studio:)[^\n]+$/m, `${answer.heading} executable Studio request`);

    const related = byLabel.get("관련 사례·스킬·템플릿");
    assert.match(related, /\[ST-(?:C|G)\d{2}\]\(use-cases\/(?:competency-paths|concept-scenarios)\.md#[^)]+\)/, `${answer.heading} case link`);
    assert.match(related, /\]\(skills\/[a-z0-9-]+\.md\)/, `${answer.heading} skill link`);
  }
}

test("use-case manifest exposes the versioned three-lane contract", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  assert.equal(manifest.version, 1);
  assert.ok(Array.isArray(manifest.audience_paths));
  assert.ok(Array.isArray(manifest.cases));
  assert.ok(Array.isArray(manifest.skill_cases));
});

test("Career manifest declares the ordered case and installed-skill coverage with deferred guide targets", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const careerCases = manifest.cases.filter((entry) => entry.product === "game-design-career");
  const careerSkillCases = manifest.skill_cases.filter((entry) => entry.product === "game-design-career");
  const careerInventory = await collectProductInventory(repoRoot, "game-design-career");
  const studioInventory = await collectProductInventory(repoRoot, "game-design-studio");

  assert.deepEqual(careerCases.filter((entry) => entry.view === "competency").map((entry) => entry.id), [
    "CA-C01", "CA-C02", "CA-C03", "CA-C04",
    "CA-C05", "CA-C06", "CA-C07", "CA-C08",
  ]);
  assert.deepEqual(careerCases.filter((entry) => entry.view === "target").map((entry) => entry.id), [
    "CA-T01", "CA-T02", "CA-T03", "CA-T04", "CA-T05",
    "CA-T06", "CA-T07", "CA-T08", "CA-T09", "CA-T10",
  ]);
  assert.equal(careerSkillCases.length, 15);
  assert.deepEqual(careerSkillCases.map((entry) => entry.id), [
    "CA-S01", "CA-S02", "CA-S03", "CA-S04", "CA-S05",
    "CA-S06", "CA-S07", "CA-S08", "CA-S09", "CA-S10",
    "CA-S11", "CA-S12", "CA-S13", "CA-S14", "CA-S15",
  ]);
  assert.deepEqual(careerSkillCases.map((entry) => entry.skill), careerInventory.skillIds);
  assertCareerManifestMetadata({ cases: careerCases, skillCases: careerSkillCases });

  const copy = (entries) => structuredClone(entries);
  const swapField = (entries, left, right, field) => {
    const swapped = copy(entries);
    [swapped[left][field], swapped[right][field]] = [swapped[right][field], swapped[left][field]];
    return swapped;
  };
  const mutationMatrix = [
    ["case document swap", () => ({ cases: swapField(careerCases, 0, 8, "document"), skillCases: careerSkillCases })],
    ["case anchor swap", () => ({ cases: swapField(careerCases, 0, 1, "anchor"), skillCases: careerSkillCases })],
    ["case diagram swap", () => ({ cases: swapField(careerCases, 0, 1, "diagram"), skillCases: careerSkillCases })],
    ["case outputs swap", () => ({ cases: swapField(careerCases, 0, 1, "outputs"), skillCases: careerSkillCases })],
    ["skill-case skill swap", () => ({ cases: careerCases, skillCases: swapField(careerSkillCases, 1, 4, "skill") })],
    ["skill-case anchor swap", () => ({ cases: careerCases, skillCases: swapField(careerSkillCases, 0, 3, "anchor") })],
    ["skill-case diagram swap", () => ({ cases: careerCases, skillCases: swapField(careerSkillCases, 8, 9, "diagram") })],
    ["skill-case outputs swap", () => ({ cases: careerCases, skillCases: swapField(careerSkillCases, 8, 9, "outputs") })],
    ["skill-case next-skills swap", () => ({ cases: careerCases, skillCases: swapField(careerSkillCases, 8, 11, "next_skills") })],
    ["CA-S ID drift", () => {
      const skillCases = copy(careerSkillCases);
      skillCases[7].id = "CA-S99";
      return { cases: careerCases, skillCases };
    }],
  ];
  for (const [label, mutate] of mutationMatrix) {
    const mutated = mutate();
    assert.throws(() => assertCareerManifestMetadata(mutated), assert.AssertionError, `${label} must fail the exact Career contract`);
  }

  const result = await validateUseCaseGuides({
    repoRoot,
    inventories: new Map([
      ["game-design-career", careerInventory],
      ["game-design-studio", studioInventory],
    ]),
    validateTargets: false,
  });
  assert.equal(result.ok, true, "Career declarations validate before their guide and diagram targets exist");
  assert.equal(result.targetValidation, "deferred");
  assert.equal(
    result.deferredTargetPaths.filter((target) => target.startsWith("guides/game-design-career/") || target.startsWith("guides/assets/game-design-career/")).length,
    99,
  );
  assert.ok(result.deferredTargetPaths.includes("guides/game-design-career/use-cases/competency-paths.md"));
  assert.ok(result.deferredTargetPaths.includes("guides/game-design-career/use-cases/concept-scenarios.md"));
  assert.ok(result.deferredTargetPaths.includes("guides/assets/game-design-career/use-cases/ca-c01.svg"));
  assert.ok(result.deferredTargetPaths.includes("guides/assets/game-design-career/use-cases/ca-t10.png"));
  assert.ok(result.deferredTargetPaths.includes("guides/game-design-career/skills/svg-infographic.md"));
  assert.ok(result.deferredTargetPaths.includes("guides/assets/game-design-career/skills/svg-infographic.png"));
});

test("Career competency and index mutation controls reject semantically wrong but structurally valid content", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { index, competencyPaths } = await readCareerCompetencyGuides();
  const entries = manifest.cases.filter((entry) => entry.product === "game-design-career" && entry.view === "competency");
  const allCareerCases = manifest.cases.filter((entry) => entry.product === "game-design-career");
  const inventory = await collectProductInventory(repoRoot, "game-design-career");
  const c01 = CAREER_COMPETENCY_HEADINGS["CA-C01"];
  const c02 = CAREER_COMPETENCY_HEADINGS["CA-C02"];
  const c01Current = sectionByHeading(sectionByHeading(competencyPaths, 2, c01), 3, "현재 상황과 목표");
  const c02Current = sectionByHeading(sectionByHeading(competencyPaths, 2, c02), 3, "현재 상황과 목표");
  const c01Next = sectionByHeading(sectionByHeading(competencyPaths, 2, c01), 3, "자기점검과 다음 학습");
  const c02Next = sectionByHeading(sectionByHeading(competencyPaths, 2, c02), 3, "자기점검과 다음 학습");
  const mutations = [
    ["CA-C01/02 current-body swap", replaceCasePart(replaceCasePart(competencyPaths, c01, "현재 상황과 목표", c02Current), c02, "현재 상황과 목표", c01Current), /CA-C01 현재 상황과 목표 semantic term: 역할/],
    ["wrong-valid CLI skill", replaceCasePart(competencyPaths, c01, "Codex CLI 요청문", sectionByHeading(sectionByHeading(competencyPaths, 2, c01), 3, "Codex CLI 요청문").replace("$game-design-career:map-game-design-career", "$game-design-career:reverse-engineer-game-design")), /CA-C01 manifest-bound CLI skill: reverse-engineer-game-design/],
    ["TODO standard practice", replaceCasePart(competencyPaths, c01, "표준 실습", "TODO"), /CA-C01 표준 실습 substantive content/],
    ["CA-C01/02 next-route swap", replaceCasePart(replaceCasePart(competencyPaths, c01, "자기점검과 다음 학습", c02Next), c02, "자기점검과 다음 학습", c01Next), /CA-C01 자기점검과 다음 학습 semantic term: CA-C02/],
  ];
  for (const [label, mutation, expectedFailure] of mutations) {
    assert.throws(
      () => assertCareerCompetencyStructure({ competencyPaths: mutation, entries, inventory }),
      expectedFailure,
      label,
    );
  }

  const c03 = CAREER_COMPETENCY_HEADINGS["CA-C03"];
  const c03Practice = sectionByHeading(sectionByHeading(competencyPaths, 2, c03), 3, "표준 실습");
  const c03Preparation = sectionByHeading(sectionByHeading(competencyPaths, 2, c03), 3, "준비 입력");
  const c03Fields = "`sourceUrl`, `location`, `retrievalDate`, `region`, `sample boundary`, `reviewAfter`";
  const c03Mutations = [
    ["stale polarity reversed", replaceCasePart(competencyPaths, c03, "표준 실습", c03Practice.replace("재검색 전까지 current claim에 사용하지 않으며", "재검색 없이 current claim에 사용하며")), /CA-C03 stale current-claim polarity/],
    ["invented example URL", replaceCasePart(competencyPaths, c03, "표준 실습", c03Practice + "\n\n예시 URL: https://invented.example/jobs"), /CA-C03 does not invent example URL/],
    ["current-evidence fields moved", replaceCasePart(replaceCasePart(competencyPaths, c03, "표준 실습", c03Practice.replace(c03Fields, "current evidence fields")), c03, "준비 입력", c03Preparation + "\n\n" + c03Fields), /CA-C03 standard-practice current evidence sourceUrl/],
  ];
  for (const [label, mutation, expectedFailure] of c03Mutations) {
    assert.throws(
      () => assertCareerCompetencyStructure({ competencyPaths: mutation, entries, inventory }),
      expectedFailure,
      label,
    );
  }

  const currentPlaintext = index.replace(
    "[CA-C01 기획 직무와 전문 분야 탐색](competency-paths.md#ca-c01-기획-직무와-전문-분야-탐색)",
    "CA-C01 기획 직무와 전문 분야 탐색 (competency-paths.md#ca-c01-기획-직무와-전문-분야-탐색)",
  );
  assert.throws(
    () => assertCareerIndexRouteStrings({ index: currentPlaintext, allCareerCases, competencyPaths }),
    /CA-C01 current Markdown link/,
    "current route must remain a Markdown link",
  );
  const futureMarkdown = index.replace(
    "`concept-scenarios.md#ca-t01-시스템-기획-입문-학생`",
    "[concept-scenarios.md#ca-t01-시스템-기획-입문-학생](concept-scenarios.md#ca-t01-시스템-기획-입문-학생)",
  );
  assert.throws(
    () => assertCareerIndexRouteStrings({ index: futureMarkdown, allCareerCases, competencyPaths }),
    /Career deferred routes contain no Markdown links/,
    "future route must stay deferred plain text",
  );
});

test("Career residual executable, freshness, and deferred-route mutations are rejected", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { index, competencyPaths } = await readCareerCompetencyGuides();
  const entries = manifest.cases.filter((entry) => entry.product === "game-design-career" && entry.view === "competency");
  const allCareerCases = manifest.cases.filter((entry) => entry.product === "game-design-career");
  const inventory = await collectProductInventory(repoRoot, "game-design-career");
  const c01 = CAREER_COMPETENCY_HEADINGS["CA-C01"];
  const c03 = CAREER_COMPETENCY_HEADINGS["CA-C03"];
  const c01Cli = sectionByHeading(sectionByHeading(competencyPaths, 2, c01), 3, "Codex CLI 요청문");
  const c01Results = sectionByHeading(sectionByHeading(competencyPaths, 2, c01), 3, "결과물");
  const c01Failure = sectionByHeading(sectionByHeading(competencyPaths, 2, c01), 3, "실패·재개");
  const c03Practice = sectionByHeading(sectionByHeading(competencyPaths, 2, c03), 3, "표준 실습");
  const competencyMutations = [
    ["CLI token only in explanatory text", replaceCasePart(competencyPaths, c01, "Codex CLI 요청문", c01Cli.replace("$game-design-career:map-game-design-career", "설명문 속 skill token $game-design-career:map-game-design-career")), /CA-C01 executable CLI command/],
    ["manifest output read order reversed", replaceCasePart(competencyPaths, c01, "결과물", c01Results.replace("`game-design-role-map`, `learning-roadmap`", "`learning-roadmap`, `game-design-role-map`")), /CA-C01 manifest output read order/],
    ["approval without evidence resume", replaceCasePart(competencyPaths, c01, "실패·재개", c01Failure + "\n\nrole evidence가 불명확해도 자동 승인하고 재개합니다."), /CA-C01 rejects approval before verification/],
    ["resume gate swap", replaceCasePart(competencyPaths, c01, "실패·재개", c01Failure.replace("사용자와 멘토가 role evidence 또는 과제 기록을 확인", "작성자와 멘토가 공개 location 또는 권리를 확인")), /CA-C01 failure-resume contract: 사용자와 멘토가 role evidence 또는 과제 기록을 확인/],
    ["stale polarity coexistence", replaceCasePart(competencyPaths, c03, "표준 실습", c03Practice + "\n\nstale evidence는 재검색 전 current claim에 사용해도 됩니다."), /CA-C03 stale\/current clause requires negative boundary/],
  ];
  for (const [label, mutation, expectedFailure] of competencyMutations) {
    assert.throws(
      () => assertCareerCompetencyStructure({ competencyPaths: mutation, entries, inventory }),
      expectedFailure,
      label,
    );
  }

  const arbitraryDeferredLink = index.replace(
    "`concept-scenarios.md#ca-t01-시스템-기획-입문-학생`",
    "`concept-scenarios.md#ca-t01-시스템-기획-입문-학생` [other deferred file](wrong.md#wrong-anchor)",
  );
  assert.throws(
    () => assertCareerIndexRouteStrings({ index: arbitraryDeferredLink, allCareerCases, competencyPaths }),
    /Career deferred routes contain no Markdown links/,
    "deferred rows reject arbitrary broken Markdown links",
  );
});

test("Career ordered-resume, refresh-workflow, and stale-permission mutations are rejected", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { competencyPaths } = await readCareerCompetencyGuides();
  const entries = manifest.cases.filter((entry) => entry.product === "game-design-career" && entry.view === "competency");
  const inventory = await collectProductInventory(repoRoot, "game-design-career");
  const c01 = CAREER_COMPETENCY_HEADINGS["CA-C01"];
  const c03 = CAREER_COMPETENCY_HEADINGS["CA-C03"];
  const c08 = CAREER_COMPETENCY_HEADINGS["CA-C08"];
  const c01Failure = sectionByHeading(sectionByHeading(competencyPaths, 2, c01), 3, "실패·재개");
  const c03Practice = sectionByHeading(sectionByHeading(competencyPaths, 2, c03), 3, "표준 실습");
  const c03Failure = sectionByHeading(sectionByHeading(competencyPaths, 2, c03), 3, "실패·재개");
  const c08Failure = sectionByHeading(sectionByHeading(competencyPaths, 2, c08), 3, "실패·재개");
  const c01Preserve = "**보존:** 기존 role map, evidence ID, 보류한 대안과 검토 날짜.";
  const mutations = [
    ["early resume", replaceCasePart(competencyPaths, c01, "실패·재개", "관찰 또는 짧은 과제로 재개합니다. " + c01Failure), /CA-C01 ordered failure-preserve-gate-resume/],
    ["same-clause resume before confirmation", replaceCasePart(competencyPaths, c01, "실패·재개", c01Failure.replace("사용자와 멘토가 role evidence 또는 과제 기록을 확인한 뒤에만", "재개하고 사용자와 멘토가 role evidence 또는 과제 기록을 확인한 뒤에만")), /CA-C01 continuation occurs only after the human gate/],
    ["preserve before failure", replaceCasePart(competencyPaths, c01, "실패·재개", c01Failure.replace(c01Preserve, "").replace("role evidence가 없으면", c01Preserve + " role evidence가 없으면")), /CA-C01 ordered failure-preserve-gate-resume/],
    ["approval synonym: continue", replaceCasePart(competencyPaths, c01, "실패·재개", c01Failure + "\n\n확인 전 승인 후 계속합니다."), /CA-C01 rejects approval before verification/],
    ["approval synonym: proceed", replaceCasePart(competencyPaths, c01, "실패·재개", c01Failure + "\n\n검토 없이 승인하고 진행합니다."), /CA-C01 rejects approval before verification/],
    ["stale permission: allowed", replaceCasePart(competencyPaths, c03, "표준 실습", c03Practice + "\n\n`reviewAfter`가 지나도 재검색 전까지 current claim에 사용해도 됩니다."), /CA-C03 stale\/current clause requires negative boundary/],
    ["old-evidence permission", replaceCasePart(competencyPaths, c03, "표준 실습", c03Practice + "\n\n오래된 evidence는 재검색 전 current claim에 사용합니다."), /CA-C03 stale\/current clause requires negative boundary/],
    ["normal and opposite coexist", replaceCasePart(competencyPaths, c03, "표준 실습", c03Practice + "\n\nstale evidence는 재검색 전 current claim에 사용해도 됩니다."), /CA-C03 stale\/current clause requires negative boundary/],
    ["negative then affirmative use", replaceCasePart(competencyPaths, c03, "표준 실습", c03Practice + "\n\nstale evidence는 current claim에 사용하지 않지만 사용할 수 있습니다."), /CA-C03 stale\/current clause requires negative boundary/],
    ["negative then affirmative reflect", replaceCasePart(competencyPaths, c03, "표준 실습", c03Practice + "\n\n오래된 evidence는 current conclusion에 반영하지 않되 반영한다."), /CA-C03 stale\/current clause requires negative boundary/],
    ["approval after no confirmation", replaceCasePart(competencyPaths, c01, "실패·재개", c01Failure + "\n\n확인 없이 승인 후 재개합니다."), /CA-C01 rejects approval before verification/],
    ["approval before validation", replaceCasePart(competencyPaths, c01, "실패·재개", c01Failure + "\n\n검증 전 승인하고 계속합니다."), /CA-C01 rejects approval before verification/],
    ["approval without grounds", replaceCasePart(competencyPaths, c01, "실패·재개", c01Failure + "\n\n근거가 없어도 승인 후 재개합니다."), /CA-C01 rejects approval before verification/],
    ["automatic approval", replaceCasePart(competencyPaths, c01, "실패·재개", c01Failure + "\n\n자동으로 승인하고 계속합니다."), /CA-C01 rejects approval before verification/],
    ["unrelated continuation", replaceCasePart(competencyPaths, c01, "실패·재개", c01Failure + "\n\n추가 작업을 계속합니다."), /CA-C01 continuation occurs only in canonical resume clause/],
    ["CA-C03 freshness before re-search", replaceCasePart(competencyPaths, c03, "실패·재개", c03Failure.replace("보존 기록과 재검색 범위를 확인한 뒤에만 공식 source를 재검색합니다. 새 source ID 또는 evidence ID와 freshness를 확인한 뒤 current conclusion을 재개합니다.", "보존 기록과 재검색 범위를 확인한 뒤에만 새 source ID 또는 evidence ID와 freshness를 확인합니다. 공식 source를 재검색한 뒤 current conclusion을 재개합니다.")), /CA-C03 ordered failure-preserve-gate-resume/],
    ["CA-C08 freshness before re-search", replaceCasePart(competencyPaths, c08, "실패·재개", c08Failure.replace("보존 기록과 재검색·재검토 범위를 확인한 뒤에만 requirement를 재검색하고 evidence를 갱신합니다. fresh requirement와 새 evidence ID, 개인 기여와 권리를 확인한 뒤 다음 proof task를 재개합니다.", "보존 기록과 재검색·재검토 범위를 확인한 뒤에만 fresh requirement와 새 evidence ID, 개인 기여와 권리를 확인합니다. requirement를 재검색하고 evidence를 갱신한 뒤 다음 proof task를 재개합니다.")), /CA-C08 ordered failure-preserve-gate-resume/],
  ];
  for (const [label, mutation, expectedFailure] of mutations) {
    assert.throws(
      () => assertCareerCompetencyStructure({ competencyPaths: mutation, entries, inventory }),
      expectedFailure,
      label,
    );
  }
  for (const negativeBoundary of ["도구는 해당 상태를 승인하지 않습니다.", "자동 승인 금지."]) {
    assert.doesNotThrow(
      () => assertCareerCompetencyStructure({ competencyPaths: replaceCasePart(competencyPaths, c01, "실패·재개", c01Failure + "\n\n" + negativeBoundary), entries, inventory }),
      `explicit negative approval boundary: ${negativeBoundary}`,
    );
  }
});

test("each Career competency case preserves its anchored case-card, evidence boundary, and deferred index routes", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { index, competencyPaths } = await readCareerCompetencyGuides();
  const entries = manifest.cases.filter((entry) => entry.product === "game-design-career" && entry.view === "competency");
  const allCareerCases = manifest.cases.filter((entry) => entry.product === "game-design-career");
  const inventory = await collectProductInventory(repoRoot, "game-design-career");
  const h2Sections = markdownSections(competencyPaths, 2);
  const anchors = collectHeadingAnchors(competencyPaths);

  assert.equal(entries.length, 8);
  assert.deepEqual(h2Sections.map(({ heading }) => heading), entries.map(({ id }) => CAREER_COMPETENCY_HEADINGS[id]));
  for (const entry of entries) {
    assert.ok(anchors.has(entry.anchor), `${entry.id} manifest anchor`);
    const caseSection = h2Sections.find(({ heading }) => heading === CAREER_COMPETENCY_HEADINGS[entry.id]);
    assert.ok(caseSection, `${entry.id} H2 section`);
    const caseParts = markdownSections(caseSection.body, 3);
    assert.deepEqual(caseParts.map(({ heading }) => heading), STUDIO_COMPETENCY_CASE_MARKERS, `${entry.id} common case-card shape`);
    for (const part of caseParts) assert.ok(part.body.length > 0, `${entry.id} ${part.heading} content`);
    const byHeading = new Map(caseParts.map((section) => [section.heading, section.body]));

    const flow = byHeading.get("스킬·템플릿 흐름");
    for (const skill of entry.skills) assert.match(flow, new RegExp("`" + skill + "`"), `${entry.id} skill ${skill}`);
    for (const template of entry.templates) assert.match(flow, new RegExp("`" + template + "`"), `${entry.id} template ${template}`);
    const results = byHeading.get("결과물");
    for (const output of entry.outputs) assert.match(results, new RegExp("`" + output + "`"), `${entry.id} output ${output}`);
    assert.match(byHeading.get("검토와 승인"), /\*\*사람 결정:\*\*/);
    assert.match(byHeading.get("검토와 승인"), /자동.*승인(?:을 )?(?:하지 않|이? (?:아니|아닙)|되지는 않)|승인을 대신하지 않/);
  }

  const c03 = sectionByHeading(competencyPaths, 2, CAREER_COMPETENCY_HEADINGS["CA-C03"]);
  for (const field of ["sourceUrl", "location", "retrievalDate", "region", "sample boundary", "reviewAfter"]) {
    assert.match(c03, new RegExp("`" + field + "`"), `CA-C03 current evidence ${field}`);
  }
  assert.match(c03, /stale.*재검색|재검색.*stale/, "CA-C03 stale re-search boundary");
  assert.match(c03, /공식.*채용|official company career page/, "CA-C03 official-source boundary");

  for (const id of ["CA-C05", "CA-C06", "CA-C07", "CA-C08"]) {
    const section = sectionByHeading(competencyPaths, 2, CAREER_COMPETENCY_HEADINGS[id]);
    assert.match(section, /evidence ID/, `${id} evidence IDs`);
    assert.match(section, /관찰 사실.*추론.*제안|observation.*inference.*proposal/s, `${id} observation inference proposal boundary`);
    assert.match(section, /개인 기여/, `${id} individual contribution boundary`);
    assert.match(section, /공개.*권리|public-rights/, `${id} public-rights review`);
    assert.match(section, /\*\*사람 결정:\*\*/, `${id} human review owner`);
    assert.match(section, /보장하지 않/, `${id} non-guarantee boundary`);
  }

  assert.match(index, /역량/, "Career index competency route");
  assert.match(index, /대상/, "Career index target route");
  assert.match(index, /직접.*스킬/, "Career index direct-skill route");
  assert.match(index, /작업 규모/, "Career index work-scale route");
  for (const entry of allCareerCases) {
    assert.match(index, new RegExp(entry.id + ".*" + entry.document.split("/").pop() + "#" + entry.anchor), `${entry.id} index route`);
  }
  assert.match(index, /\.\.\/\.\.\/use-cases\/README\.md#공통-faq/, "Career index shared FAQ route");
  assert.match(index, /\.\.\/\.\.\/use-cases\/output-catalog\.md/, "Career index shared output catalog route");
  assertCareerCompetencyStructure({ competencyPaths, entries, inventory });
  assertCareerIndexRouteStrings({ index, allCareerCases, competencyPaths });
});

test("Studio manifest declares the ordered case and installed-skill coverage with deferred guide targets", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const studioCases = manifest.cases.filter((entry) => entry.product === "game-design-studio");
  const competencyCases = studioCases.filter((entry) => entry.view === "competency");
  const conceptCases = studioCases.filter((entry) => entry.view === "concept");
  const studioSkillCases = manifest.skill_cases.filter((entry) => entry.product === "game-design-studio");
  const inventory = await collectProductInventory(repoRoot, "game-design-studio");
  const careerInventory = await collectProductInventory(repoRoot, "game-design-career");

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
    inventories: new Map([
      ["game-design-studio", inventory],
      ["game-design-career", careerInventory],
    ]),
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

function assertStudioSkillCaseRouting({ cases, inventory, routing }) {
  const routedSkills = new Set(routing.routes.map((route) => route.skill));
  const nonRouteBoundarySkills = new Set([
    routing.qualityWorkflow.skill,
    "plan-image-assets",
    "generate-image-assets",
    "review-image-assets",
    "svg-infographic",
  ]);
  assert.ok(routing.routes.length > 0, "canonical routing.routes must not be empty");
  assert.deepEqual(
    [...routedSkills].sort(),
    inventory.skillIds.filter((skill) => !nonRouteBoundarySkills.has(skill)).sort(),
    "every non-boundary installed skill has an actual canonical route",
  );

  assert.deepEqual(cases.map((entry) => entry.skill), inventory.skillIds, "skill cases follow the installed inventory");
  for (const entry of cases) {
    assert.ok(routedSkills.has(entry.skill) || nonRouteBoundarySkills.has(entry.skill), `${entry.skill}: canonical route or explicit boundary`);
  }
}

test("Studio skill cases resolve to direct-use anchors and canonical routing lanes", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const inventory = await collectProductInventory(repoRoot, "game-design-studio");
  const routing = JSON.parse(await readFile(
    path.join(repoRoot, "products/game-design-studio/plugin/references/routing.json"),
    "utf8",
  ));
  const cases = manifest.skill_cases.filter((entry) => entry.product === "game-design-studio");

  assertStudioSkillCaseRouting({ cases, inventory, routing });
  for (const entry of cases) {
    const markdown = await readFile(path.join(repoRoot, entry.document), "utf8");
    const expectedHeading = `### 직접 호출 활용 — ${entry.skill}`;
    assert.ok(markdown.includes(expectedHeading), `${entry.id}: direct-use heading exists`);
    assert.ok(collectHeadingAnchors(markdown).has(entry.anchor), `${entry.id}: manifest anchor resolves`);
  }

  assert.throws(
    () => assertStudioSkillCaseRouting({ cases, inventory, routing: { ...routing, routes: [] } }),
    "empty canonical routing.routes must fail",
  );
});

test("Studio use-case index routes all eighteen published competency and concept cases", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { index, competencyPaths, conceptScenarios } = await readStudioUseCaseGuides();
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
  assert.ok(links.some(({ target }) => target === "skill-workbench.md"), "published skill workbench route");
  assert.ok(links.some(({ label, target }) => label === "Studio FAQ" && target === "../faq.md"), "published Studio FAQ route");
  assert.ok(links.some(({ target }) => target === "../../use-cases/output-catalog.md"), "output catalog route");
  for (const [name, markdown] of Object.entries({ index, competencyPaths, conceptScenarios })) {
    assert.doesNotMatch(markdown, /Task 6|FAQ 예정/, `${name} rejects stale staged copy`);
  }
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
    /unsafe numeric outcome claim/,
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
  const classifierMismatches = STUDIO_NUMERIC_CLAIM_CASES
    .filter(([decision, sentence]) => isUnsafeNumericOutcomeSentence(sentence) !== (decision === "reject"))
    .map(([, sentence]) => sentence);
  assert.deepEqual(classifierMismatches, [], "numeric classifier decision table");
  for (const [decision, sentence] of STUDIO_NUMERIC_CLAIM_CASES) {
    const mutation = conceptScenarios.replace("이 문서는", `${sentence}\n\n이 문서는`);
    assert.notEqual(mutation, conceptScenarios, `numeric claim mutation: ${sentence}`);
    if (decision === "reject") {
      assert.throws(
        () => assertStudioConceptSemantics({ conceptScenarios: mutation, entries, inventory }),
        /numeric outcome claim/,
        sentence,
      );
    } else {
      assert.doesNotThrow(
        () => assertStudioConceptSemantics({ conceptScenarios: mutation, entries, inventory }),
        sentence,
      );
    }
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

test("Studio FAQ contains all eighteen approved questions with executable, bounded answers", async () => {
  const faqPath = path.join(repoRoot, "guides", "game-design-studio", "faq.md");
  const stat = await lstat(faqPath);
  assert.ok(stat.isFile() && !stat.isSymbolicLink(), "Studio FAQ must be a regular file");
  const markdown = await readFile(faqPath, "utf8");
  assertStudioFaq(markdown);
});

test("Studio FAQ contract rejects missing requests, swapped answers, and wrong questions", async () => {
  const faqPath = path.join(repoRoot, "guides", "game-design-studio", "faq.md");
  const markdown = await readFile(faqPath, "utf8");
  const answers = markdownSections(markdown, 3);
  const first = answers[0];
  const second = answers[1];
  const firstRequest = inlineFields(first.body).find(({ label }) => label === "실행 요청").value;
  const withoutRequest = markdown.replace(firstRequest, "TODO");
  assert.throws(
    () => assertStudioFaq(withoutRequest),
    /Q01\. .* 실행 요청 substantive content/,
  );

  const swapped = markdown
    .replace(first.body, "__FIRST_ANSWER__")
    .replace(second.body, first.body)
    .replace("__FIRST_ANSWER__", second.body);
  assert.throws(
    () => assertStudioFaq(swapped),
    /Q01\. .* conclusion term: 규칙/,
  );

  const wrongQuestion = markdown.replace(first.heading, "Q01. 승인되지 않은 다른 질문");
  assert.throws(
    () => assertStudioFaq(wrongQuestion),
    /Studio FAQ approved question headings/,
  );

  const injectedH2 = markdown.replace("**예상 결과:**", "## 다른 섹션\n\n**예상 결과:**");
  assert.throws(
    () => assertStudioFaq(injectedH2),
    /Q01\. .* answer shape/,
  );
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

test("Studio case and direct-skill diagrams are source-linked, rendered, and embedded exactly once", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const diagramManifest = JSON.parse(await readFile(path.join(repoRoot, "guides/assets/diagram-manifest.json"), "utf8"));
  const sources = JSON.parse(await readFile(path.join(repoRoot, "guides/assets/use-case-diagram-sources.json"), "utf8"));
  const studioCases = manifest.cases.filter(({ product }) => product === "game-design-studio");
  const studioSkills = manifest.skill_cases.filter(({ product }) => product === "game-design-studio");
  const caseSources = sources.filter(({ scope }) => scope === "game-design-studio-use-case");
  const skillSources = sources.filter(({ scope }) => scope === "game-design-studio-skill");
  const caseDiagrams = diagramManifest.diagrams.filter(({ scope }) => scope === "game-design-studio-use-case");
  const skillDiagrams = diagramManifest.diagrams.filter(({ scope }) => scope === "game-design-studio-skill");
  const exactSpecialists = {
    "st-c01": "define-game-vision", "st-c02": "design-game-systems", "st-c03": "design-game-systems", "st-c04": "design-player-experience",
    "st-c05": "design-game-content", "st-c06": "design-game-content", "st-c07": "design-game-economy-and-liveops", "st-c08": "plan-game-production",
    "st-g01": "design-game-economy-and-liveops", "st-g02": "design-game-systems", "st-g03": "design-game-systems", "st-g04": "design-game-systems", "st-g05": "design-game-content",
    "st-g06": "design-game-content", "st-g07": "design-player-experience", "st-g08": "design-game-economy-and-liveops", "st-g09": "design-game-content", "st-g10": "design-player-experience",
  };

  assert.equal(caseSources.length, 18, "Studio case diagram source count");
  assert.equal(skillSources.length, 15, "Studio direct-skill diagram source count");
  assert.equal(caseDiagrams.length, 18, "Studio case diagram manifest count");
  assert.equal(skillDiagrams.length, 15, "Studio direct-skill diagram manifest count");

  const expectedEntries = [
    ...studioCases.map((entry) => ({ entry, type: entry.view === "competency" ? "design-pipeline" : "decision-flow", kind: "use-cases" })),
    ...studioSkills.map((entry) => ({ entry, type: "skill-flow", kind: "skills" })),
  ];
  for (const { entry, type, kind } of expectedEntries) {
    const id = entry.id.toLowerCase();
    const source = sources.find((candidate) => candidate.id === id);
    const diagram = diagramManifest.diagrams.find((candidate) => candidate.id === id);
    assert.ok(source, `${entry.id} diagram source`);
    assert.ok(diagram, `${entry.id} diagram manifest entry`);
    validateDiagramSource(source);
    assert.equal(source.type, type, `${entry.id} diagram type`);
    assert.equal(source.steps.length, 5, `${entry.id} five physical semantic stages`);
    assert.ok(source.semantic && typeof source.semantic === "object", `${entry.id} semantic metadata`);
    assert.deepEqual(source.semantic.outputs, entry.outputs, `${entry.id} exact output IDs`);
    if (entry.view === "competency") {
      assert.deepEqual(source.steps.map(({ stage }) => stage), ["입력", "전문 스킬", "Canonical Artifact", "검토", "출력"], `${entry.id} competency stage grammar`);
      assert.equal(source.semantic.specialist, exactSpecialists[id], `${entry.id} exact specialist skill`);
      assert.equal(source.semantic.review.skill, "review-game-design", `${entry.id} exact review skill`);
      assert.ok(source.semantic.review.condition.length > 0, `${entry.id} review condition`);
    } else if (entry.view === "concept") {
      assert.deepEqual(source.steps.map(({ stage }) => stage), ["제약", "선택지", "판단 기준", "결정", "검증"], `${entry.id} concept stage grammar`);
      assert.equal(source.semantic.specialist, exactSpecialists[id], `${entry.id} exact concept specialist`);
      assert.ok(source.semantic.validation.length > 0, `${entry.id} validation condition`);
      assert.ok(Array.isArray(source.branches) && source.branches.length >= 2, `${entry.id} branch choices`);
    } else {
      assert.deepEqual(source.steps.map(({ stage }) => stage), ["trigger", "필수 입력", "skill-owned work", "output", "next route"], `${entry.id} skill-flow stage grammar`);
      assert.equal(source.semantic.skill, entry.skill, `${entry.id} exact installed skill`);
      assert.deepEqual(source.semantic.next_routes, entry.next_skills, `${entry.id} exact next routes`);
    }
    assert.deepEqual(source.source_paths, [entry.document], `${entry.id} source document`);
    assert.deepEqual(source.used_by, [entry.document], `${entry.id} used-by document`);
    assert.equal(diagram.svg, entry.diagram.svg.replace(/^guides\/assets\//, ""), `${entry.id} SVG path`);
    assert.equal(diagram.png, entry.diagram.png.replace(/^guides\/assets\//, ""), `${entry.id} PNG path`);
    assert.equal(diagram.alt, entry.diagram.alt, `${entry.id} manifest alt`);
    assert.deepEqual(diagram.sources, [`../${entry.document.replace(/^guides\//, "")}`], `${entry.id} manifest source`);
    assert.deepEqual(diagram.usedBy, [`../${entry.document.replace(/^guides\//, "")}`], `${entry.id} manifest usedBy`);

    const markdown = await readFile(path.join(repoRoot, entry.document), "utf8");
    const scope = entry.skill
      ? sectionByHeading(markdown, 3, `직접 호출 활용 — ${entry.skill}`)
      : sectionByHeading(markdown, 2, entry.view === "competency" ? STUDIO_COMPETENCY_HEADINGS[entry.id] : STUDIO_CONCEPT_HEADINGS[entry.id]);
    const relativeAsset = entry.diagram.png
      .replace(/^guides\/assets\//, "../../assets/")
      .replace(/\.png$/, "");
    const escapedAlt = entry.diagram.alt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const embed = new RegExp(`\\[!\\[${escapedAlt}\\]\\(${relativeAsset}\\.png\\)\\]\\(${relativeAsset}\\.svg\\)`, "gu");
    assert.equal(scope.match(embed)?.length ?? 0, 1, `${entry.id} exactly one editable SVG-wrapped PNG embed`);

    const svg = await readFile(path.join(repoRoot, entry.diagram.svg), "utf8");
    assert.match(svg, /^<svg\b[^>]*>\s*<title>[^<\s][\s\S]*?<\/title>\s*<desc>[^<\s][\s\S]*?<\/desc>/u, `${entry.id} SVG title and desc`);
    assert.deepEqual(parseViewBox(svg), { w: 1400, h: 900 }, `${entry.id} SVG viewBox`);
    assert.ok(isCompletePng(path.join(repoRoot, entry.diagram.png)), `${entry.id} complete PNG`);
    assert.deepEqual(pngDims(path.join(repoRoot, entry.diagram.png)), { w: 2800, h: 1800 }, `${entry.id} PNG dimensions`);
  }

  const result = await buildUseCaseDiagrams({ repoRoot, ids: expectedEntries.map(({ entry }) => entry.id.toLowerCase()), check: true });
  assert.deepEqual(result, { svg: 33, png: 33 }, "Studio diagrams pass Skillstead lint and generated-file check");
});

test("Studio diagram semantic bindings reject wrong-valid skills, outputs, next routes, and removed branches", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const sources = JSON.parse(await readFile(path.join(repoRoot, "guides/assets/use-case-diagram-sources.json"), "utf8"));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const caseById = new Map(manifest.cases.filter(({ product }) => product === "game-design-studio").map((entry) => [entry.id.toLowerCase(), entry]));
  const skillById = new Map(manifest.skill_cases.filter(({ product }) => product === "game-design-studio").map((entry) => [entry.id.toLowerCase(), entry]));
  const specialists = {
    "st-c01": "define-game-vision", "st-c02": "design-game-systems", "st-c03": "design-game-systems", "st-c04": "design-player-experience",
    "st-c05": "design-game-content", "st-c06": "design-game-content", "st-c07": "design-game-economy-and-liveops", "st-c08": "plan-game-production",
    "st-g01": "design-game-economy-and-liveops", "st-g02": "design-game-systems", "st-g03": "design-game-systems", "st-g04": "design-game-systems", "st-g05": "design-game-content",
    "st-g06": "design-game-content", "st-g07": "design-player-experience", "st-g08": "design-game-economy-and-liveops", "st-g09": "design-game-content", "st-g10": "design-player-experience",
  };
  const assertCaseBinding = (source) => {
    const entry = caseById.get(source.id);
    assert.equal(source.semantic.specialist, specialists[source.id], `${source.id} specialist`);
    assert.deepEqual(source.semantic.outputs, entry.outputs, `${source.id} outputs`);
  };
  const assertSkillBinding = (source) => {
    const entry = skillById.get(source.id);
    assert.equal(source.semantic.skill, entry.skill, `${source.id} installed skill`);
    assert.deepEqual(source.semantic.next_routes, entry.next_skills, `${source.id} next route`);
  };
  const c01 = sourceById.get("st-c01");
  assert.throws(() => assertCaseBinding({ ...c01, semantic: { ...c01.semantic, specialist: "orchestrate-game-design-project" } }), /specialist/u);
  assert.throws(() => assertCaseBinding({ ...c01, semantic: { ...c01.semantic, outputs: c01.semantic.outputs.slice(1) } }), /outputs/u);
  const s09 = sourceById.get("st-s09");
  assert.throws(() => assertSkillBinding({ ...s09, semantic: { ...s09.semantic, next_routes: ["review-game-design"] } }), /next route/u);
  const g01 = sourceById.get("st-g01");
  assert.throws(() => validateDiagramSource({ ...g01, branches: [g01.branches[0]] }), /two branches/u);
});

const STUDIO_DIAGRAM_PRODUCTION_EXPECTED = Object.freeze({
  "st-c01": { kind: "competency", specialist: "define-game-vision", outputs: ["vision-pillars", "game-design-brief", "game-design-review"], review: { skill: "review-game-design", condition: "named owner가 근거·가정·blocker를 검토" } },
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
  "st-s02": { kind: "skill", skill: "define-game-vision", trigger: ["비전 trigger", "경험 목표를 받습니다."], requiredInput: "player promise + design constraints", outputs: ["vision-pillars", "core-motivation-loop"], nextRoutes: ["design-game-systems"], nextCondition: null, routeIds: ["vision"] },
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
});

const STUDIO_CANONICAL_ROUTE_EXPECTED = Object.freeze({
  "project-orchestration": { triggerIntents: ["multi-discipline project", "game design brief", "scope planning", "project roadmap", "milestone planning", "ambiguous design request"], skill: "orchestrate-game-design-project", requiredInputs: ["target player", "target experience", "platform", "genre", "development stage", "constraints", "completion criteria"], artifactType: "game-design-brief" },
  vision: { triggerIntents: ["game vision", "design pillars", "core fun", "motivation loop"], skill: "define-game-vision", requiredInputs: ["target player", "desired emotion", "experience intent", "constraints"], artifactType: "vision-pillars" },
  systems: { triggerIntents: ["game system", "rules", "state transitions", "data schema"], skill: "design-game-systems", requiredInputs: ["system purpose", "inputs", "constraints", "failure expectations"], artifactType: "system-specification" },
  content: { triggerIntents: ["quest", "level content", "narrative", "character", "enemy"], skill: "design-game-content", requiredInputs: ["content purpose", "supporting systems", "production budget", "repeatability target"], artifactType: "narrative-quest-npc" },
  "player-experience": { triggerIntents: ["player experience", "UX flow", "tutorial", "accessibility", "input"], skill: "design-player-experience", requiredInputs: ["critical actions", "platform", "input methods", "first-session goal"], artifactType: "ui-ux-flow-state" },
  economy: { triggerIntents: ["game economy", "monetization", "currency balance", "shop balance"], skill: "design-game-economy-and-liveops", requiredInputs: ["business model", "currencies", "progression target", "target inventory", "real-price policy"], artifactType: "economy-balance" },
  liveops: { triggerIntents: ["LiveOps", "event plan", "experiment", "segment rollout"], skill: "design-game-economy-and-liveops", requiredInputs: ["event goal", "experiment hypothesis", "control", "sample and duration", "protection metrics"], artifactType: "liveops-experiment-event" },
  production: { triggerIntents: ["production plan", "scope", "milestone", "prototype", "risk"], skill: "plan-game-production", requiredInputs: ["target experience", "team", "schedule", "technology", "dependencies"], artifactType: "production-scope-risk" },
  review: { triggerIntents: ["design review", "critique", "launch readiness", "risk review"], skill: "review-game-design", requiredInputs: ["canonical artifact", "review questions", "decision owner"], artifactType: "game-design-review" },
  visualization: { triggerIntents: ["diagram", "visualize", "flow chart", "economy map", "roadmap diagram"], skill: "visualize-game-design", requiredInputs: ["valid canonical artifact", "relationship to clarify", "target audience"], artifactType: "canonical-artifact" },
  export: { triggerIntents: ["export", "PDF", "DOCX", "presentation", "PPTX"], skill: "export-game-design-documents", requiredInputs: ["valid canonical artifact", "requested formats", "audience", "purpose"], artifactType: "canonical-artifact" },
});

function cloneStudioDiagramSource(source) {
  return JSON.parse(JSON.stringify(source));
}

test("Studio production diagram contract fixes every persisted source against independent expected values", async () => {
  const sources = JSON.parse(await readFile(path.join(repoRoot, "guides/assets/use-case-diagram-sources.json"), "utf8"));
  const routing = JSON.parse(await readFile(path.join(repoRoot, "products/game-design-studio/plugin/references/routing.json"), "utf8"));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const routeById = new Map(routing.routes.map((route) => [route.id, route]));

  assert.deepEqual(STUDIO_DIAGRAM_PRODUCTION_CONTRACT, STUDIO_DIAGRAM_PRODUCTION_EXPECTED, "production validator uses the independent expected source contract");
  assert.deepEqual(STUDIO_CANONICAL_ROUTE_PRODUCTION_CONTRACT, STUDIO_CANONICAL_ROUTE_EXPECTED, "production validator uses the independent expected canonical route contract");
  assert.equal(STUDIO_CANONICAL_ROUTE_ARRAY_POLICY, "ordered-exact", "triggerIntents and requiredInputs preserve exact order and membership");
  assert.doesNotThrow(() => validateStudioDiagramProductionBatch(sources, routing));
  assert.deepEqual([...sourceById.keys()].filter((id) => id.startsWith("st-")).sort(), Object.keys(STUDIO_DIAGRAM_PRODUCTION_EXPECTED).sort());
  assert.deepEqual([...routeById.keys()].sort(), Object.keys(STUDIO_CANONICAL_ROUTE_EXPECTED).sort());
  for (const [routeId, expected] of Object.entries(STUDIO_CANONICAL_ROUTE_EXPECTED)) {
    const route = routeById.get(routeId);
    assert.deepEqual({ triggerIntents: route.triggerIntents, skill: route.skill, requiredInputs: route.requiredInputs, artifactType: route.artifactType }, expected, `${routeId} canonical route condition and target`);
  }

  for (const [id, expected] of Object.entries(STUDIO_DIAGRAM_PRODUCTION_EXPECTED)) {
    const source = sourceById.get(id);
    assert.ok(source, `${id} persisted source`);
    if (expected.kind === "competency") {
      assert.deepEqual({ specialist: source.semantic.specialist, outputs: source.semantic.outputs, review: source.semantic.review }, { specialist: expected.specialist, outputs: expected.outputs, review: expected.review }, `${id} exact competency mapping`);
    } else if (expected.kind === "concept") {
      assert.deepEqual({ specialist: source.semantic.specialist, outputs: source.semantic.outputs, constraint: [source.steps[0].label, source.steps[0].detail], criterion: [source.steps[2].label, source.steps[2].detail], decision: [source.steps[3].label, source.steps[3].detail], branches: source.branches.map(({ label, detail }) => [label, detail]), validation: source.semantic.validation }, { specialist: expected.specialist, outputs: expected.outputs, constraint: expected.constraint, criterion: expected.criterion, decision: expected.decision, branches: expected.branches, validation: expected.validation }, `${id} exact concept mapping`);
    } else {
      assert.deepEqual({ skill: source.semantic.skill, trigger: [source.steps[0].label, source.steps[0].detail], requiredInput: source.semantic.required_input, outputs: source.semantic.outputs, nextRoutes: source.semantic.next_routes, nextCondition: source.semantic.next_condition ?? null }, { skill: expected.skill, trigger: expected.trigger, requiredInput: expected.requiredInput, outputs: expected.outputs, nextRoutes: expected.nextRoutes, nextCondition: expected.nextCondition }, `${id} exact skill mapping`);
      for (const routeId of expected.routeIds) assert.equal(routeById.get(routeId).skill, expected.skill, `${id} canonical route target ${routeId}`);
      for (const target of expected.nextRoutes) assert.ok(routing.skillIds.includes(target), `${id} canonical route target skill ${target}`);
    }
  }
});

test("Studio production validator rejects the table-driven wrong-valid mutation matrix", async () => {
  const sources = JSON.parse(await readFile(path.join(repoRoot, "guides/assets/use-case-diagram-sources.json"), "utf8"));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const entries = Object.entries(STUDIO_DIAGRAM_PRODUCTION_EXPECTED);
  const alternate = (id, kind, differs) => entries.find(([candidateId, candidate]) => candidateId !== id && candidate.kind === kind && differs(candidate))[1];
  const assertProductionReject = (source, id, label, { schemaValid = true } = {}) => {
    if (schemaValid) validateDiagramSource(source);
    assert.throws(() => validateStudioDiagramProductionContract(source), new RegExp(id, "u"), label);
  };

  for (const [id, expected] of entries) {
    const source = sourceById.get(id);
    if (expected.kind === "competency") {
      const other = alternate(id, expected.kind, (candidate) => candidate.specialist !== expected.specialist && JSON.stringify(candidate.outputs) !== JSON.stringify(expected.outputs));
      for (const semantic of [
        { ...source.semantic, specialist: other.specialist },
        { ...source.semantic, outputs: other.outputs },
        { ...source.semantic, review: { ...source.semantic.review, skill: "design-game-systems" } },
        { ...source.semantic, specialist: "전문 판단을 적용" },
      ]) assertProductionReject({ ...cloneStudioDiagramSource(source), semantic }, id, `${id} rejects wrong-valid competency mapping`);
    } else if (expected.kind === "concept") {
      const otherSpecialist = alternate(id, expected.kind, (candidate) => candidate.specialist !== expected.specialist);
      const otherOutputs = alternate(id, expected.kind, (candidate) => JSON.stringify(candidate.outputs) !== JSON.stringify(expected.outputs));
      const otherBranches = alternate(id, expected.kind, (candidate) => JSON.stringify(candidate.branches) !== JSON.stringify(expected.branches));
      const otherValidation = alternate(id, expected.kind, (candidate) => candidate.validation !== expected.validation);
      for (const mutation of [
        { ...cloneStudioDiagramSource(source), semantic: { ...source.semantic, specialist: otherSpecialist.specialist } },
        { ...cloneStudioDiagramSource(source), semantic: { ...source.semantic, outputs: otherOutputs.outputs } },
        { ...cloneStudioDiagramSource(source), branches: otherBranches.branches.map(([label, detail]) => ({ label, detail })) },
        { ...cloneStudioDiagramSource(source), semantic: { ...source.semantic, validation: otherValidation.validation } },
        { ...cloneStudioDiagramSource(source), steps: source.steps.map((step, index) => index === 0 ? { ...step, label: "대안 두 가지" } : step) },
        { ...cloneStudioDiagramSource(source), branches: source.branches.map((branch, index) => index === 0 ? { ...branch, label: "대안 두 가지" } : branch) },
      ]) assertProductionReject(mutation, id, `${id} rejects wrong-valid concept mapping`);
      assertProductionReject({ ...cloneStudioDiagramSource(source), branches: [source.branches[0]] }, id, `${id} rejects removed concept branch`, { schemaValid: false });
    } else {
      const otherSkill = alternate(id, expected.kind, (candidate) => candidate.skill !== expected.skill);
      const otherInput = alternate(id, expected.kind, (candidate) => candidate.requiredInput !== expected.requiredInput);
      const otherOutputs = alternate(id, expected.kind, (candidate) => JSON.stringify(candidate.outputs) !== JSON.stringify(expected.outputs));
      const otherRoutes = alternate(id, expected.kind, (candidate) => JSON.stringify(candidate.nextRoutes) !== JSON.stringify(expected.nextRoutes) || candidate.nextCondition !== expected.nextCondition);
      for (const semantic of [
        { ...source.semantic, skill: otherSkill.skill },
        { ...source.semantic, required_input: otherInput.requiredInput },
        { ...source.semantic, outputs: otherOutputs.outputs },
        { ...source.semantic, next_routes: otherRoutes.nextRoutes, next_condition: otherRoutes.nextCondition ?? undefined },
        { ...source.semantic, required_input: "artifact와 경계" },
      ]) assertProductionReject({ ...cloneStudioDiagramSource(source), semantic }, id, `${id} rejects wrong-valid skill mapping`);
    }
  }
});

test("persisted Studio diagrams expose exact source semantics instead of generic placeholders", async () => {
  const sources = JSON.parse(await readFile(path.join(repoRoot, "guides/assets/use-case-diagram-sources.json"), "utf8"));
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const compactVisibleText = (value) => value.replace(/<[^>]+>/gu, "").replace(/\s+/gu, "");

  for (const source of sources.filter(({ scope }) => scope === "game-design-studio-use-case" || scope === "game-design-studio-skill")) {
    const expected = STUDIO_DIAGRAM_PRODUCTION_EXPECTED[source.id];
    const svg = await readFile(path.join(repoRoot, "guides/assets", expected.kind === "skill" ? "game-design-studio/skills" : "game-design-studio/use-cases", `${expected.kind === "skill" ? expected.skill : source.id}.svg`), "utf8");
    const visibleText = compactVisibleText(svg);
    if (expected.kind === "competency") {
      for (const value of [expected.specialist, ...expected.outputs, expected.review.skill]) assert.match(visibleText, new RegExp(escapeRegExp(compactVisibleText(value)), "u"), `${source.id} visible ${value}`);
      assert.doesNotMatch(svg, /전문 판단을 적용/u, `${source.id} no generic specialist placeholder`);
    } else if (expected.kind === "concept") {
      for (const value of [
        ...expected.constraint,
        ...expected.criterion,
        ...expected.decision,
        ...expected.branches.flat(),
        expected.specialist,
        ...expected.outputs,
        expected.validation,
      ]) {
        assert.match(visibleText, new RegExp(escapeRegExp(compactVisibleText(value)), "u"), `${source.id} visible ${value}`);
      }
      assert.doesNotMatch(svg, /대안 두 가지/u, `${source.id} no generic choice placeholder`);
    } else {
      for (const value of [...expected.trigger, expected.requiredInput, expected.skill, ...expected.outputs, ...expected.nextRoutes, expected.nextCondition].filter(Boolean)) {
        assert.match(visibleText, new RegExp(escapeRegExp(compactVisibleText(value)), "u"), `${source.id} visible ${value}`);
      }
      assert.doesNotMatch(svg, /artifact와 경계/u, `${source.id} no generic input placeholder`);
    }
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
