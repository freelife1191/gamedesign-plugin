# 결과물 카탈로그

이 문서는 요청별로 보존할 원본, 선택 자산, 파생 형식과 사람 검토 지점을 정리합니다. 템플릿의 정확한 구조와 스킬 입력 계약은 각 제품의 설치 가이드가 권위 있습니다.

## 최소 결과

최소 결과는 renderer나 이미지 provider가 없어도 Canonical Artifact에 남아야 하는 원본입니다. `content.md`에는 문제, 가정, 근거, 결정, 미해결 사항을 남기고, 증거·결정·자산은 파일 경로와 상태를 분리합니다.

## 선택 결과

선택 결과는 요청, mode, capability와 사람 선택에 따라 더하는 prompt, 생성 이미지, SVG·PNG, PDF·DOCX·PPTX 준비 자료입니다. 생성 이미지는 항상 `concept-draft`로 시작하며, SVG·PNG는 source, 접근성 설명, lint·render·visual QA evidence 없이 승인된 결과가 아닙니다.

## 확장 결과

확장 결과는 사람 검토와 필요한 형식별 QA를 통과한 전달용 문서 또는 공개 가능한 Career 증거입니다. PDF·DOCX·PPTX의 성공은 downstream renderer와 format/visual QA가 모두 있어야 하며, 그 전에는 준비 상태·재개 조건만 기록합니다.

## Studio 요청과 결과

| 사용자 요청 | 템플릿 | 최소 파일 | 선택 이미지·도식 자산 | 파생 형식 | 사람 검토 | 포트폴리오·팀 활용 |
| --- | --- | --- | --- | --- | --- | --- |
| 핵심 경험과 비전 정리 | `game-design-brief`, `vision-pillars` | `content.md`, `evidence.yml`, `decisions/` | concept-draft 이미지 prompt, 비전 흐름 SVG·PNG | MD, PDF·DOCX·PPTX 준비 | 대상·제약·검증 기준 | 팀 킥오프와 공개 가능한 문제 정의 |
| 규칙·상태·예외 명세 | `system-specification`, `rule-exception-matrix`, `data-schema-table-contract` | `content.md`, 규칙·상태 표, `decisions/` | 상태 흐름 SVG·PNG | MD, PDF·DOCX 준비 | 규칙 모순, 구현·검증 가능성 | 팀 handoff와 개인 판단 evidence |
| UX·콘텐츠·경제 검토 | `ui-ux-flow-state`, `narrative-quest-npc`, `economy-balance` | `content.md`, 가정·검토 큐, `evidence.yml` | concept-draft 이미지, 흐름·의존성 SVG·PNG | MD, PDF·PPTX 준비 | 접근성, 밸런스 가정, 미해결 위험 | 검토 기록과 반복 개선 근거 |
| 제작 범위·위험·출력 준비 | `production-scope-risk`, `decision-change-log`, `game-design-review` | `content.md`, 위험·결정 로그, `export-manifest.yml` | 승인 전 도식 source, 이미지 prompt | MD, PDF·DOCX·PPTX 준비 | owner, 승인, 형식 QA | 팀 전달; 공개 가능 evidence만 Career로 handoff |

## Career 요청과 결과

| 사용자 요청 | 템플릿 | 최소 파일 | 선택 이미지·도식 자산 | 파생 형식 | 사람 검토 | 포트폴리오·팀 활용 |
| --- | --- | --- | --- | --- | --- | --- |
| 역할·공고·학습 경로 정리 | `game-design-role-map`, `job-posting-evidence`, `learning-roadmap` | `content.md`, `evidence.yml`, `decisions/` | 역할·경로 SVG·PNG | MD, PDF·PPTX 준비 | 확인일, 지역, 표본 경계 | 학습 계획과 직무 대화 준비 |
| 관찰 기반 게임 분석 | `game-analysis-report`, `reverse-design-document` | `content.md`, 관찰·추론 구분, `evidence.yml` | 분석 도식 SVG·PNG, proof image prompt | MD, PDF·DOCX 준비 | 사실·추론·반례, 권리 | 공개 가능한 분석 사례 |
| 포트폴리오 프로젝트 구성 | `portfolio-project-brief`, `creative-design-portfolio`, `portfolio-backlog` | `content.md`, 개인 기여·검증 근거, `decisions/` | concept-draft proof image, 사례 흐름 SVG·PNG | MD, PDF·PPTX 준비 | 공개 가능성, 개인 기여, 발표 메시지 | 포트폴리오와 면접 evidence |
| 검토·면접·성장 기록 | `five-axis-review`, `interview-question-answer-log`, `junior-growth-review` | `content.md`, review findings, `evidence.yml` | 수정 우선순위 도식, 발표 이미지 prompt | MD, PDF·PPTX 준비 | 주장·근거 연결, 다음 검증 | 검토 큐, 면접 연습, 성장 기록 |

## Canonical Artifact 읽는 순서

원본을 먼저 읽고, 어떤 근거와 결정이 자산·파생 형식에 연결되는지 확인합니다.

```text
content.md
→ evidence.yml
→ decisions/
→ assets/
→ export-manifest.yml
```

`content.md`와 MD는 renderer 부재에도 남습니다. 자산이 없거나 파생 형식이 실패해도 원본, evidence, decisions와 재개 조건을 덮어쓰거나 폐기하지 않습니다.

## Studio → Career handoff

Studio Canonical Artifact와 Career Canonical Artifact는 분리합니다. Studio에서 Career로는 공개 가능한 **문제**, **결정**, **대안**, **검증 evidence**만 요약해 별도 Career portfolio project brief의 입력으로 전달합니다. Studio 원본을 포트폴리오 원본으로 복제하거나 두 Artifact를 하나의 폴더로 합치지 않습니다.

다음은 handoff와 공개 결과에서 제외합니다.

- NDA 또는 회사 비공개 자료
- 팀원 개인 식별 정보와 연락처 등 팀 PII
- 소유권·사용 허가가 확인되지 않은 이미지, 화면, 기타 자산
- 확인되지 않은 팀 성과, 매출, retention, 일정 또는 개인 기여 주장

Career의 사람 검토는 Studio 결과의 공개 가능성·품질·성과를 자동 승인하지 않습니다. 권리, 개인 기여, 사실·가정 경계와 검증 evidence를 다시 확인한 뒤에만 확장 결과로 사용합니다.
