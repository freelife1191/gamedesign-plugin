import { isDeepStrictEqual } from "node:util";

const COMPETENCY_ROWS = [
  ["ca-c01", "기획 직무와 전문 분야를 비교하는 흐름", "현재 경험과 역할 후보", "역할·전문 분야 비교", "career strategist", "채용 결과를 보장하지 않음", "CA-C02 또는 CA-C03", ["game-design-role-map", "learning-roadmap"]],
  ["ca-c02", "게임 분석의 관찰과 추론을 분리하는 흐름", "공개 build 관찰 기록", "관찰·추론 분리", "game analysis reviewer", "내부 구현을 추정하지 않음", "CA-C03 또는 CA-C04", ["game-analysis-report", "reverse-design-document"]],
  ["ca-c03", "현재 채용공고의 근거와 표본 경계를 기록하는 흐름", "공식 공고와 retrievalDate", "표본·요건 정규화", "career reviewer", "stale evidence는 재검색", "CA-C04 또는 CA-C08", ["job-posting-evidence", "game-design-role-map"]],
  ["ca-c04", "역량 격차를 학습과 증거 과제로 전환하는 흐름", "gap과 evidence ID", "학습·proof 과제 계획", "mentor", "경험을 지어 내지 않음", "CA-C05 또는 CA-C06", ["competency-matrix", "learning-roadmap"]],
  ["ca-c05", "관찰과 추론 및 반례를 기록하는 역기획 흐름", "공개 build와 evidence ID", "반증 가능한 역기획", "public-rights reviewer", "권리 없는 내부 자료 제외", "CA-C06 또는 CA-C07", ["reverse-design-document", "game-analysis-report"]],
  ["ca-c06", "창작 기획의 판단과 근거를 포트폴리오로 연결하는 흐름", "개인 기여와 evidence ID", "창작 case 구성", "portfolio reviewer", "성과·채용을 보장하지 않음", "CA-C07 또는 CA-C08", ["portfolio-project-brief", "creative-design-portfolio"]],
  ["ca-c07", "포트폴리오 검토와 수정 및 발표 준비 흐름", "claim과 evidence ID", "five-axis 최소 수정", "portfolio reviewer", "자동 승인은 아님", "CA-C08 또는 export-career-documents", ["five-axis-review", "portfolio-backlog", "introduction-motivation"]],
  ["ca-c08", "면접과 주니어 성장 및 직무 전환의 증거 흐름", "질문·growth evidence ID", "면접·성장·전환 계획", "mentor·manager·career reviewer", "채용·승진·전환을 보장하지 않음", "CA-C03 또는 CA-C04", ["interview-question-answer-log", "junior-growth-review", "transition-readiness"]],
];

const TARGET_ROWS = [
  ["ca-t01", "시스템 기획 입문 학생의 증거 과제와 학습 경로", "시스템 기획", "입문 학생", "상태 전이와 예외 표", "잠금 해제 규칙표", "규칙표 proof 작성", "시스템 기획 멘토", "합격을 보장하지 않음", "상태 전이 또는 예외 표가 관찰되지 않으면 claim을 보류합니다.", "상태 전이, 예외 표, 규칙표와 반례.", "시스템 기획 멘토가 규칙과 예외의 범위를 읽고 질문을 남깁니다.", "확인된 잠금 해제 기능의 규칙표에서 재개합니다.", ["CA-T02", "CA-T03"], ["game-design-role-map", "competency-matrix", "learning-roadmap"]],
  ["ca-t02", "콘텐츠와 퀘스트 기획 준비생의 제작 가능성 증거 흐름", "콘텐츠·퀘스트 기획", "준비생", "퀘스트 상태와 분기 조건", "짧은 의뢰·NPC", "짧은 의뢰 flow", "콘텐츠 기획 멘토", "채용을 보장하지 않음", "퀘스트 상태 또는 분기 조건이 불명확하면 claim을 보류합니다.", "퀘스트 상태, 분기 조건, 의뢰 흐름과 대안.", "콘텐츠 기획 멘토가 분기와 제작 범위의 질문을 검토합니다.", "확인된 짧은 의뢰의 분기에서 재개합니다.", ["CA-T06", "CA-T07"], ["game-design-role-map", "portfolio-project-brief", "creative-design-portfolio"]],
  ["ca-t03", "전투와 캐릭터 기획 준비생의 분석과 검증 흐름", "전투·캐릭터 기획", "준비생", "cooldown과 피해 판정", "스킬 하나·반례", "스킬 반례 작성", "전투 기획 멘토", "합격을 보장하지 않음", "cooldown 또는 피해 판정이 관찰되지 않으면 claim을 보류합니다.", "cooldown, 피해 판정, 스킬 명세와 반례.", "전투 기획 멘토가 선택의 이유와 반례를 검토합니다.", "확인된 스킬 하나의 피드백에서 재개합니다.", ["CA-T04", "CA-T07"], ["game-analysis-report", "portfolio-project-brief", "creative-design-portfolio"]],
  ["ca-t04", "경제와 밸런스 및 LiveOps 준비생의 가정 검증 흐름", "경제·밸런스·LiveOps", "준비생", "source와 sink", "재화 흐름·rollback", "guardrail·rollback 가설", "경제·밸런스 검토자", "시장 성공을 보장하지 않음", "source 또는 sink 근거가 없으면 claim을 보류합니다.", "source, sink, guardrail과 rollback 가설.", "경제·밸런스 검토자가 가설과 보호 기준의 질문을 확인합니다.", "확인된 재화 흐름의 guardrail에서 재개합니다.", ["CA-T01", "CA-T10"], ["game-analysis-report", "portfolio-project-brief", "five-axis-review"]],
  ["ca-t05", "UI UX 기획 준비생의 접근성과 usability 증거 흐름", "UI·UX 기획", "준비생", "오류 상태와 대체 입력", "온보딩·대체 입력", "온보딩 usability 흐름", "UX·접근성 검토자", "채용을 보장하지 않음", "오류 상태 또는 대체 입력이 관찰되지 않으면 claim을 보류합니다.", "오류 상태, focus 기록, 온보딩 흐름과 수정 전후.", "UX·접근성 검토자가 사용성 관찰과 누락을 확인합니다.", "확인된 온보딩 화면의 오류 상태에서 재개합니다.", ["CA-T02", "CA-T08"], ["competency-matrix", "portfolio-project-brief", "five-axis-review"]],
  ["ca-t06", "내러티브 기획 준비생의 협업 계약과 증거 흐름", "내러티브 기획", "준비생", "등장인물 목표와 분기", "대화 장면·handoff", "대화 handoff 작성", "내러티브 기획 멘토", "합격을 보장하지 않음", "장면 분기 또는 공개 경계가 불명확하면 claim을 보류합니다.", "등장인물 목표, 분기표, handoff와 공개 제외 목록.", "내러티브 기획 멘토가 장면 목적과 협업 경계를 검토합니다.", "확인된 대화 장면의 선택 분기에서 재개합니다.", ["CA-T02", "CA-T07"], ["game-design-role-map", "portfolio-project-brief", "creative-design-portfolio"]],
  ["ca-t07", "레벨 디자인 준비생의 공간과 playtest 증거 흐름", "레벨 디자인", "준비생", "동선과 시야", "한 구역·playtest", "한 구역 playtest", "레벨 디자인 멘토", "실무 경험을 보장하지 않음", "동선 또는 시야가 관찰되지 않으면 claim을 보류합니다.", "동선, 시야, playtest 질문과 수정 로그.", "레벨 디자인 멘토가 공간 의도와 관찰의 범위를 검토합니다.", "확인된 한 구역의 막힘에서 재개합니다.", ["CA-T03", "CA-T08"], ["game-analysis-report", "portfolio-project-brief", "five-axis-review"]],
  ["ca-t08", "실무 경험이 없는 신입의 판단과 반복 개선 증거 흐름", "신입 기획 준비", "무경력 신입", "개인 기여와 수정 전후", "한 페이지·수정", "작은 proof 반복", "포트폴리오 검토자", "채용을 보장하지 않음", "개인 기여 또는 수정 근거가 불명확하면 claim을 보류합니다.", "판단 근거, 수정 전후, 작은 사례와 honest gap.", "포트폴리오 검토자가 개인 기여와 수정 근거를 확인합니다.", "확인된 한 페이지 proof의 수정에서 재개합니다.", ["CA-T01", "CA-T09"], ["career-stage-goal", "portfolio-project-brief", "portfolio-backlog"]],
  ["ca-t09", "직군 전환자의 전이 가능한 역량과 새 증거 과제 흐름", "직군 전환", "비전공·전환", "이전 경험과 새 evidence", "전환 지도·새 과제", "전환 지도와 새 과제", "Career 검토자", "이직을 보장하지 않음", "이전 경험의 공개 경계 또는 새 evidence가 불명확하면 claim을 보류합니다.", "이전 경험, 새 evidence, 전환 지도와 공개 제외 목록.", "Career 검토자가 이전 경험의 사실과 새 과제의 경계를 확인합니다.", "확인된 새 evidence 과제에서 재개합니다.", ["CA-T03", "CA-T10"], ["transition-readiness", "game-design-role-map", "portfolio-project-brief"]],
  ["ca-t10", "주니어의 성장과 이직 준비도 증거 흐름", "주니어 성장·이직", "주니어", "growth review와 현재 공고", "수정 사례·면접 답변", "수정 사례·면접 답변", "manager 또는 career reviewer", "승진·이직을 보장하지 않음", "growth review 또는 current requirement가 오래되었으면 claim을 보류합니다.", "growth review, 현재 공고, 수정 사례와 honest gap.", "manager 또는 career reviewer가 성장 기록과 다음 질문을 검토합니다.", "확인된 수정 사례와 다음 review에서 재개합니다.", ["CA-T04", "CA-T09"], ["junior-growth-review", "transition-readiness", "interview-question-answer-log"]],
];

const SKILL_ROWS = [
  ["ca-s01", "품질 프로필 호출", "Career 문서 품질 프로필 직접 호출 흐름", "apply-document-quality-profile", "한 Artifact profile 선택", "Career Artifact와 template", "profile 선택", ["selection-record", "quality-checklist", "requirement-manifest"], "document-quality-editor", "선택은 문서 승인이나 콘텐츠 생성을 대신하지 않음", "unknown ID 또는 profile conflict", "기존 기록", "document-quality-editor가 설치된 template과 artifact ID를 확인", "같은 선택 기록에서 재개", "map·research·portfolio·reverse·interview·review·growth·visualization·export·image plan route일 때만", [["map route일 때", "map-game-design-career"], ["research route일 때", "research-game-design-jobs"], ["portfolio route일 때", "build-game-design-portfolio"], ["reverse route일 때", "reverse-engineer-game-design"], ["interview route일 때", "practice-game-design-interview"], ["review route일 때", "review-game-design-portfolio"], ["growth route일 때", "plan-junior-growth"], ["visualization route일 때", "visualize-career-roadmap"], ["export route일 때", "export-career-documents"], ["image plan route일 때", "plan-image-assets"]]],
  ["ca-s02", "포트폴리오 호출", "게임 기획 포트폴리오 직접 호출 흐름", "build-game-design-portfolio", "한 portfolio claim 구조", "claim과 evidence", "portfolio case 구성", ["portfolio-project-brief", "creative-design-portfolio"], "portfolio-reviewer", "성과·채용을 보장하지 않음", "claim 또는 evidence ID 누락", "unknown과 gap", "portfolio-reviewer가 개인 기여와 public rights를 확인", "같은 claimId에서 재개", "검토·면접·export 조건일 때", [["검토 조건", "review-game-design-portfolio"], ["면접 조건", "practice-game-design-interview"], ["export 조건", "export-career-documents"]]],
  ["ca-s03", "export 호출", "Career 문서 출력 직접 호출 흐름", "export-career-documents", "한 Artifact export 준비", "승인 대기 Artifact와 format", "export 준비", ["export-preparation-manifest", "format-jobs"], "evidence-auditor", "downstream renderer·format QA·사람 승인을 대체하지 않음", "renderer 또는 capability 부재", "원본과 blocked job", "evidence-auditor가 source와 evidence completion gate를 확인", "실제 renderer 결과와 format QA 지점에서 재개", "terminal lane이므로 다음 스킬을 자동 호출하지 않음", []],
  ["ca-s04", "이미지 생성 호출", "Career 이미지 자산 생성 직접 호출 흐름", "generate-image-assets", "선택 receipt의 finite job", "selection receipt와 asset ID", "finite image job 처리", ["image-generation-result", "image-generation-provenance"], "visual-asset-reviewer", "named human approval 전에는 final binding하지 않음", "provider 또는 selection receipt 부재", "prompt·placeholder와 lifecycle", "visual-asset-reviewer가 provider routing과 실제 사용자 decision을 확인", "stable asset ID에서 재개", "review가 필요할 때만", [["review 필요", "review-image-assets"]]],
  ["ca-s05", "커리어 map 호출", "게임 기획 경로 매핑 직접 호출 흐름", "map-game-design-career", "한 목표 역할의 gap", "current evidence와 role", "role map·gap 작성", ["game-design-role-map", "competency-matrix"], "career-strategist", "사실·추론·제안을 분리하고 채용을 보장하지 않음", "current evidence가 stale", "원래 source", "career-strategist가 fresh evidence와 retrievalDate를 확인", "확인된 route에서 재개", "research·portfolio·visualization 조건일 때", [["research 조건", "research-game-design-jobs"], ["portfolio 조건", "build-game-design-portfolio"], ["visualization 조건", "visualize-career-roadmap"]]],
  ["ca-s06", "커리어 orchestration", "게임 기획 커리어 오케스트레이션 직접 호출 흐름", "orchestrate-game-design-career", "여러 stage의 skill chain", "goal·stage·current evidence", "skill chain·stage brief", ["career-stage-goal", "career-stage-brief"], "career-strategist", "단일 specialist를 추측하지 않고 사실·추론·제안을 분리", "route 또는 stage 불명확", "unknown", "decision owner가 stage를 확인", "확인된 route에서 재개", "선택 route가 map·research·portfolio·reverse·interview·review·growth·visualization·export 중 하나일 때만", [["선택 route가 map일 때", "map-game-design-career"], ["선택 route가 research일 때", "research-game-design-jobs"], ["선택 route가 portfolio일 때", "build-game-design-portfolio"], ["선택 route가 reverse일 때", "reverse-engineer-game-design"], ["선택 route가 interview일 때", "practice-game-design-interview"], ["선택 route가 review일 때", "review-game-design-portfolio"], ["선택 route가 growth일 때", "plan-junior-growth"], ["선택 route가 visualization일 때", "visualize-career-roadmap"], ["선택 route가 export일 때", "export-career-documents"]]],
  ["ca-s07", "이미지 계획 호출", "Career 이미지 자산 계획 직접 호출 흐름", "plan-image-assets", "finite image slot 계획", "profile과 image slot", "stable asset 계획", ["image-assets-manifest", "image-prompts"], "art-brief-director", "계획은 실제 SVG·PNG 생성이나 승인이 아님", "slot mismatch 또는 필수 입력 누락", "stable ID와 placeholder", "art-brief-director가 slot·수량·source section을 확인", "확정한 slot에서 재개", "finite illustration 또는 Skillstead slot일 때", [["finite illustration job", "generate-image-assets"], ["Skillstead diagram slot", "visualize-career-roadmap"]]],
  ["ca-s08", "주니어 성장 호출", "주니어 성장 계획 직접 호출 흐름", "plan-junior-growth", "한 requirement의 proof task", "requirement와 project event", "growth proof 계획", ["junior-growth-review", "transition-readiness"], "game-design-mentor", "사실·추론·제안을 분리하고 성장 결과를 보장하지 않음", "stale evidence 또는 requirement", "기존 stale 기록·상태·한계", "game-design-mentor가 fresh sourceId와 requirementId를 확인", "proof task에서 재개", "visualization·export 조건일 때", [["visualization 조건", "visualize-career-roadmap"], ["export 조건", "export-career-documents"]]],
  ["ca-s09", "면접 연습 호출", "게임 기획 면접 연습 직접 호출 흐름", "practice-game-design-interview", "한 evidence question 연습", "questionId와 posting evidence", "answer feedback 기록", ["interview-question-answer-log", "honest-answer-patterns"], "interview-coach·evidence-auditor", "채용 결과를 보장하지 않고 posting evidence를 추적", "stale posting evidence 또는 questionId 누락", "기존 기록·stale 상태·한계", "interview-coach와 evidence-auditor가 fresh posting과 stable questionId를 확인", "answer-feedback record에서 재개", "growth·portfolio review 조건일 때", [["growth 조건", "plan-junior-growth"], ["portfolio review 조건", "review-game-design-portfolio"]]],
  ["ca-s10", "채용 조사 호출", "게임 기획 채용 근거 조사 직접 호출 흐름", "research-game-design-jobs", "한 current posting 표본", "role·level·region", "current posting 조사", ["job-posting-evidence", "evidence-gap-plan"], "evidence-auditor", "stale evidence를 current 결론으로 사용하지 않음", "sourceUrl 또는 retrievalDate 누락", "현재 source ID와 evidence gap", "evidence-auditor가 fresh source의 여섯 필드를 확인", "확인한 evidence ID에서 재개", "map·portfolio·interview 조건일 때", [["map 조건", "map-game-design-career"], ["portfolio 조건", "build-game-design-portfolio"], ["interview 조건", "practice-game-design-interview"]]],
  ["ca-s11", "역기획 호출", "게임 역기획 직접 호출 흐름", "reverse-engineer-game-design", "한 public build 관찰", "public build와 source ID", "관찰·추론·반례", ["reverse-design-document", "game-analysis-report"], "reverse-design-critic·evidence-auditor", "관찰·추론·제안을 분리하고 내부 구현을 추정하지 않음", "observation 또는 source 부재", "unknown implementation detail", "review owner가 공개 관찰과 source citation을 확인", "validation queue에서 재개", "portfolio·export 조건일 때", [["portfolio 조건", "build-game-design-portfolio"], ["export 조건", "export-career-documents"]]],
  ["ca-s12", "포트폴리오 검토", "게임 기획 포트폴리오 검토 직접 호출 흐름", "review-game-design-portfolio", "한 portfolio finding", "portfolio section과 evidence ID", "five-axis finding", ["five-axis-review", "portfolio-backlog"], "portfolio-reviewer", "검토는 자동 승인이나 채용 보장이 아님", "inspectable source 부재", "not-observed와 blocked finding", "portfolio-reviewer가 evidence ID를 확인", "같은 findingId review에서 재개", "portfolio·interview·export 조건일 때", [["portfolio 조건", "build-game-design-portfolio"], ["interview 조건", "practice-game-design-interview"], ["export 조건", "export-career-documents"]]],
  ["ca-s13", "이미지 검토 호출", "Career 이미지 자산 검토 직접 호출 흐름", "review-image-assets", "한 stable asset transition", "stable asset ID와 decisionReceipt", "lifecycle transition 검토", ["image-asset-review", "lifecycle-receipt"], "named-human-reviewer", "agent finding은 승인이나 state transition이 아님", "actual decision·reviewer·reviewedAt·evidence·rightsDecision 누락", "기존 state와 finding", "named-human-reviewer가 누락 evidence와 targetState를 확인", "같은 stable ID transition에서 재개", "document-approved일 때만", [["document-approved", "export-career-documents"]]],
  ["ca-s14", "SVG 호출", "Career SVG 인포그래픽 직접 호출 흐름", "svg-infographic", "한 source-mapped SVG", "source ID와 relationship", "editable SVG 작성", ["editable-svg", "png-2x", "render-evidence"], "game-design-mentor", "Node-free fallback을 보존하고 시각 QA는 문서 승인이 아님", "Node 또는 Chromium fallback 차단", "SVG source와 manual source checklist", "game-design-mentor가 fallback과 source mapping을 확인", "마지막 lint·render·visual QA에서 재개", "relationship가 준비됐을 때만", [["relationship ready", "visualize-career-roadmap"]]],
  ["ca-s15", "로드맵 시각화", "게임 기획 커리어 로드맵 시각화 직접 호출 흐름", "visualize-career-roadmap", "한 relationship slot", "relationship과 diagram slot", "source-mapped 시각화", ["editable-svg", "png-2x", "visualization-evidence"], "game-design-mentor", "Node-free fallback을 보존하고 시각 QA는 문서 승인이 아님", "source mapping 또는 renderer fallback 부재", "SVG-only 상태와 warning", "game-design-mentor가 fallback과 source mapping을 확인", "마지막 lint·render·visual QA에서 재개", "export-ready condition일 때만", [["export-ready", "export-career-documents"]]],
];

const CASE_TITLES = Object.freeze({
  "ca-c01": "CA-C01 기획 직무와 전문 분야 탐색",
  "ca-c02": "CA-C02 게임 분석 언어와 관찰·추론 분리",
  "ca-c03": "CA-C03 현재 채용공고 조사",
  "ca-c04": "CA-C04 역량 격차와 학습·증거 계획",
  "ca-c05": "CA-C05 관찰 기반 역기획",
  "ca-c06": "CA-C06 창작 기획 포트폴리오",
  "ca-c07": "CA-C07 포트폴리오 검토·수정·발표",
  "ca-c08": "CA-C08 면접·주니어 성장·직무 전환",
  "ca-t01": "CA-T01 시스템 기획 입문 학생",
  "ca-t02": "CA-T02 콘텐츠·퀘스트 기획 준비생",
  "ca-t03": "CA-T03 전투·캐릭터 기획 준비생",
  "ca-t04": "CA-T04 경제·밸런스·LiveOps 준비생",
  "ca-t05": "CA-T05 UI·UX 기획 준비생",
  "ca-t06": "CA-T06 내러티브 기획 준비생",
  "ca-t07": "CA-T07 레벨 디자인 준비생",
  "ca-t08": "CA-T08 실무 경험이 없는 신입",
  "ca-t09": "CA-T09 비전공자·다른 직군 전환자",
  "ca-t10": "CA-T10 주니어의 성장·이직",
});

const CASE_ANCHORS = Object.freeze({
  "ca-c01": "ca-c01-기획-직무와-전문-분야-탐색",
  "ca-c02": "ca-c02-게임-분석-언어와-관찰추론-분리",
  "ca-c03": "ca-c03-현재-채용공고-조사",
  "ca-c04": "ca-c04-역량-격차와-학습증거-계획",
  "ca-c05": "ca-c05-관찰-기반-역기획",
  "ca-c06": "ca-c06-창작-기획-포트폴리오",
  "ca-c07": "ca-c07-포트폴리오-검토수정발표",
  "ca-c08": "ca-c08-면접주니어-성장직무-전환",
  "ca-t01": "ca-t01-시스템-기획-입문-학생",
  "ca-t02": "ca-t02-콘텐츠퀘스트-기획-준비생",
  "ca-t03": "ca-t03-전투캐릭터-기획-준비생",
  "ca-t04": "ca-t04-경제밸런스liveops-준비생",
  "ca-t05": "ca-t05-uiux-기획-준비생",
  "ca-t06": "ca-t06-내러티브-기획-준비생",
  "ca-t07": "ca-t07-레벨-디자인-준비생",
  "ca-t08": "ca-t08-실무-경험이-없는-신입",
  "ca-t09": "ca-t09-비전공자다른-직군-전환자",
  "ca-t10": "ca-t10-주니어의-성장이직",
});

const upper = (id) => id.toUpperCase();
const caseSteps = (id) => [
  { stage: "evidence input", label: "증거 입력", detail: `${upper(id)} 근거 확인` },
  { stage: "owned work", label: "소유 작업", detail: `${upper(id)} 작업 수행` },
  { stage: "human review", label: "사람 검토", detail: `${upper(id)} 검토 요청` },
  { stage: "boundary", label: "경계 확인", detail: `${upper(id)} 경계 보존` },
  { stage: "output / next route", label: "출력·다음 경로", detail: `${upper(id)} 결과 연결` },
];
const skillSteps = (id) => [
  { stage: "trigger", label: "직접 호출 조건", detail: `${upper(id)} 호출 조건` },
  { stage: "evidence input", label: "근거 입력", detail: `${upper(id)} 입력 확인` },
  { stage: "skill-owned work", label: "스킬 소유 작업", detail: `${upper(id)} 작업 수행` },
  { stage: "output", label: "출력 ID", detail: `${upper(id)} 출력 기록` },
  { stage: "next route", label: "다음 조건", detail: `${upper(id)} 재개 경로` },
];

function competencySource([id, alt, evidence, ownedWork, humanReview, boundary, nextRoute, outputs]) {
  const document = "guides/game-design-career/use-cases/competency-paths.md";
  const anchor = CASE_ANCHORS[id];
  return {
    id,
    anchor,
    scope: "game-design-career-use-case",
    title: CASE_TITLES[id],
    description: `${evidence}를 ${ownedWork}로 정리해 검토 가능한 경로를 만듭니다.`,
    alt,
    type: "design-pipeline",
    eyebrow: `${upper(id)} · CAREER CASE`,
    conclusion: `검토 가능한 결과를 남기고 ${nextRoute} 조건을 확인합니다.`,
    steps: caseSteps(id),
    source_paths: [`${document}#${anchor}`],
    used_by: [`${document}#${anchor}`],
    semantic: { evidence, owned_work: ownedWork, human_review: humanReview, boundary, next_route: nextRoute, outputs },
  };
}

function targetSource([id, alt, role, stage, evidence, use, ownedWork, humanReview, boundary, failure, preserve, humanConfirmation, resume, routeTargets, outputs]) {
  const document = "guides/game-design-career/use-cases/concept-scenarios.md";
  const anchor = CASE_ANCHORS[id];
  const nextRoutes = routeTargets.map((target, index) => ({
    condition: index === 0 ? `${use} proof가 확인됨` : `${evidence} 보강이 필요함`,
    target,
  }));
  return {
    id,
    anchor,
    scope: "game-design-career-use-case",
    title: CASE_TITLES[id],
    description: `${stage}가 ${evidence}를 ${use}에 쓰고 사람 검토 뒤 재개하는 경로입니다.`,
    alt,
    type: "decision-flow",
    eyebrow: `${upper(id)} · CAREER TARGET`,
    conclusion: `${role}의 ${use}를 검토하고 조건에 맞는 다음 사례로 이동합니다.`,
    steps: [
      { stage: "evidence input", label: `${role} ${stage}`, detail: evidence },
      { stage: "owned work", label: use, detail: ownedWork },
      { stage: "human review", label: `${upper(id)} 검토 owner`, detail: "질문 뒤 범위 확인" },
      { stage: "boundary", label: "실패·보존 경계", detail: boundary },
      { stage: "output / next route", label: "확인 후 재개", detail: routeTargets.join(" 또는 ") },
    ],
    source_paths: [`${document}#${anchor}`],
    used_by: [`${document}#${anchor}`],
    semantic: {
      role,
      stage,
      evidence,
      use,
      owned_work: ownedWork,
      human_review: humanReview,
      boundary,
      failure,
      preserve,
      human_confirmation: humanConfirmation,
      resume,
      next_condition: `${humanReview} 확인 뒤 조건에 맞는 route로 이동`,
      next_route: routeTargets.join(" 또는 "),
      next_routes: nextRoutes,
      outputs,
    },
    branches: [
      { label: `${upper(id)} proof 확인`, detail: `첫 route ${routeTargets[0]}` },
      { label: `${upper(id)} 근거 보강`, detail: `둘째 route ${routeTargets[1]}` },
    ],
  };
}

const CAREER_ANCHOR_PREFIX_IDS = new Set(["ca-s01", "ca-s04", "ca-s07", "ca-s13", "ca-s14"]);

function skillSource([id, shortTitle, alt, skill, trigger, requiredInput, ownedWork, outputs, reviewer, boundary, failure, preserve, humanConfirmation, resume, nextCondition, nextRoutes]) {
  const anchorPrefix = CAREER_ANCHOR_PREFIX_IDS.has(id) ? "career-직접-호출-활용" : "직접-호출-활용";
  const document = `guides/game-design-career/skills/${skill}.md`;
  const anchor = `${anchorPrefix}-${skill}`;
  return {
    id,
    anchor,
    scope: "game-design-career-skill",
    title: `${upper(id)} ${shortTitle}`,
    description: `${requiredInput}을 받아 ${ownedWork}를 수행하고 조건부 다음 경로를 남깁니다.`,
    alt,
    type: "skill-flow",
    eyebrow: `${upper(id)} · CAREER SKILL`,
    conclusion: `정확한 output ID와 조건부 route, ${resume} 조건을 기록합니다.`,
    steps: skillSteps(id),
    source_paths: [`${document}#${anchor}`],
    used_by: [`${document}#${anchor}`],
    semantic: {
      skill,
      trigger,
      required_input: requiredInput,
      owned_work: ownedWork,
      outputs,
      reviewer,
      boundary,
      failure,
      preserve,
      human_confirmation: humanConfirmation,
      resume,
      next_condition: nextCondition,
      next_route: nextRoutes[0]?.[1] ?? "pending format job",
      next_routes: nextRoutes.map(([condition, target]) => ({ condition, target })),
    },
  };
}

const sources = [
  ...COMPETENCY_ROWS.map(competencySource),
  ...TARGET_ROWS.map(targetSource),
  ...SKILL_ROWS.map(skillSource),
];

export const CAREER_DIAGRAM_PRODUCTION_CONTRACT = Object.freeze(Object.fromEntries(sources.map((source) => [source.id, Object.freeze(source)])));
export const CAREER_DIAGRAM_PRODUCTION_IDS = Object.freeze(Object.keys(CAREER_DIAGRAM_PRODUCTION_CONTRACT));

function mismatchPath(actual, expected, prefix = "source") {
  if (isDeepStrictEqual(actual, expected)) return null;
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return prefix;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) return prefix;
    for (let index = 0; index < expected.length; index += 1) {
      const mismatch = mismatchPath(actual[index], expected[index], `${prefix}[${index}]`);
      if (mismatch) return mismatch;
    }
    return prefix;
  }
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (!isDeepStrictEqual(actualKeys, expectedKeys)) return prefix;
  for (const key of expectedKeys) {
    const mismatch = mismatchPath(actual[key], expected[key], `${prefix}.${key}`);
    if (mismatch) return mismatch;
  }
  return prefix;
}

export function validateCareerDiagramProductionContract(source) {
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    throw new TypeError("Career production source must be an object");
  }
  const expected = CAREER_DIAGRAM_PRODUCTION_CONTRACT[source.id];
  if (!expected) throw new TypeError(`Career production source ID is not canonical: ${String(source.id)}`);
  const mismatch = mismatchPath(source, expected);
  if (mismatch) throw new TypeError(`${source.id} Career production contract mismatch: ${mismatch}`);
}

export function validateCareerDiagramProductionBatch(allSources, routing) {
  if (!Array.isArray(allSources)) throw new TypeError("Career production sources must be an array");
  const careerSources = allSources.filter(({ scope } = {}) => scope === "game-design-career-use-case" || scope === "game-design-career-skill");
  const ids = careerSources.map(({ id }) => id);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))].sort();
  if (duplicates.length) throw new TypeError(`duplicate Career production source IDs: ${duplicates.join(", ")}`);
  const expectedIds = CAREER_DIAGRAM_PRODUCTION_IDS;
  const missing = expectedIds.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => !expectedIds.includes(id));
  if (missing.length || extra.length) {
    throw new TypeError(`Career production source IDs mismatch: missing [${missing.join(", ")}], extra [${extra.join(", ")}]`);
  }
  for (const source of careerSources) validateCareerDiagramProductionContract(source);

  if (routing === null || typeof routing !== "object" || !Array.isArray(routing.skillIds)) {
    throw new TypeError("Career routing.skillIds must be an array");
  }
  const installedSkills = new Set([...routing.skillIds, "svg-infographic"]);
  for (const source of careerSources.filter(({ scope }) => scope === "game-design-career-skill")) {
    if (!installedSkills.has(source.semantic.skill)) throw new TypeError(`${source.id} skill ${source.semantic.skill} is absent from installed skillIds`);
    for (const route of source.semantic.next_routes) {
      if (!installedSkills.has(route.target)) {
        throw new TypeError(`${source.id} next route target ${route.target} is absent from installed skillIds`);
      }
    }
  }
}
