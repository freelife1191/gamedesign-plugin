# Curated Archify inventory

이 디렉터리는 과거의 일괄 생성 Archify 가이드를 대신하는 **선별 inventory**입니다. 이전 계층은 같은 형식의 HTML을 문서 수에 맞춰 넓게 만들었지만, 이제는 관계·분기·상태·책임 handoff가 원문보다 더 잘 읽히는 경우만 후보로 남깁니다. 현재 4개 `selected` 항목은 모두 committed `spec`과 검증 기록을 가지며, 검증·시각 QA를 통과한 한국어 HTML 4개를 `published` 상태로 공개합니다.

## 처음 보는 사용자를 위한 흐름

1. `catalog.json`에서 문서별 `selected` 또는 `excluded` 결정을 찾습니다.
2. `selected`의 `question`, `diagram_type_reason`, `composition_rationale`가 실제로 어떤 질문을 도식으로 풀지 설명합니다.
3. 현재 4개 `selected` spec은 모두 Archify showcase 9/9, 오류·경고 0을 통과했습니다.
4. `published`는 4개입니다. 각 공개 HTML은 한국어 뷰어와 검증 receipt를 가지며, Chromium headless에서 원본 크기와 페이지 맞춤(fit) 관점을 검토했습니다. 아래 Published 목록에서 바로 열 수 있습니다.

## 증거와 전수 범위

catalog은 고정된 `scan_roots`와 `scan_excludes`를 사용해 모든 Markdown 문서를 결정론적으로 스캔합니다. 각 entry의 `source_document`는 정확히 하나의 스캔 문서이고, `source_section`은 그 파일에 실제로 있는 heading이며, `source_digest`는 현재 파일 bytes의 SHA-256입니다. 따라서 원문 또는 heading이 바뀌면 inventory는 stale-source가 되어 다음 단계 전에 다시 검토해야 합니다.

검증 명령은 다음과 같습니다.

```bash
node --test tests/unit/archify-catalog.test.mjs tests/contracts/archify-catalog.test.mjs
node tooling/validate-archify-catalog.mjs --json
```

`products/game-design-studio/**`와 `products/game-design-career/**`는 모두 `excluded-package-surface`입니다. `plugins/game-design-studio/**`와 `plugins/game-design-career/**`는 각각 해당 `products/` 패키지의 배포 mirror이므로 모두 `excluded-package-mirror`입니다. 둘은 분석 기록만 남기며 catalog이 패키지 밖으로 향하는 링크를 만들지 않습니다.

## 선택 기준과 수량

수량은 목표가 아닙니다. root 또는 `guides/**` 문서 중에서 의존 단계, 역할 handoff, 승인, hold·resume, retry·rollback, artifact 변환, 다중 구성 요소 또는 상태 전환을 도식이 실제로 더 명확하게 보여 줄 때만 선택합니다. 요청문 카드, 단일 참조, 설치 안내와 이미 Skillstead가 담당하는 스킬 설명은 텍스트로 남깁니다.

문서마다 primary는 최대 하나이며, primary 질문으로 답할 수 없는 실제로 직교한 질문만 secondary 하나를 더할 수 있습니다. 같은 문서를 여러 도식으로 늘려 수량을 맞추지 않습니다.

## 제품별 시각 차이

- **Studio**는 비전에서 설계·검토·자산·내보내기로 이어지는 제작 흐름, 안전 guardrail, rollback을 강조합니다.
- **Career**는 단계 진단, evidence 축적, 멘토·검토자 피드백, 보완·보류·재개와 포트폴리오·면접 handoff를 강조합니다.
- **Suite**는 Studio와 Career를 하나의 거대 도식으로 합치지 않습니다. 공개 가능한 evidence만 제품 경계를 넘어가는 handoff와 사용자 경로를 보입니다.

선택된 entry의 `visual_system`은 반드시 product와 같아서 이후 저작 단계가 이 차이를 보존합니다.

## delivery와 visual-review 상태

선택된 entry에는 다음 delivery 상태가 있습니다.

| 상태 | 의미 |
| --- | --- |
| `planned` | 후보와 미래 경로만 기록됨; spec은 아직 없음 |
| `spec-authored` | spec을 작성했지만 자동 검증 전 |
| `auto-validated` | Archify 자동 검증 통과, 시각 검토 대기 |
| `blocked-schema` | schema 문제로 진행 중단 |
| `blocked-validation` | 자동 validation 진단을 해결하지 못함 |
| `blocked-visual` | 사람 시각 검토에서 실패 |
| `stale-source` | source bytes 또는 근거 heading이 바뀌어 재검토 필요 |
| `passed` | spec·검증·사람 시각 검토 통과 |
| `published` | 통과한 HTML과 receipt를 공개함 |

`planned`, `spec-authored`, `auto-validated`는 `visual_review: pending`입니다. `blocked-schema`와 `blocked-validation`은 `not-applicable`, `blocked-visual`은 `failed`, `stale-source`는 `stale-source`, `passed`와 `published`는 `passed`입니다. excluded entry는 언제나 `delivery_status`와 `visual_review`가 모두 `not-applicable`이며 spec·HTML·receipt 경로가 없습니다.

## 결정 코드

- `excluded-better-as-text`: 도식보다 직접 읽는 문장·표·요청문이 명확함
- `excluded-skillstead-overlap`: 기존 Skillstead 시각화 책임과 겹침
- `excluded-insufficient-evidence`: 관계를 사실로 고정할 근거가 부족함
- `excluded-package-surface`: products 배포 표면
- `excluded-package-mirror`: plugins 배포 mirror

catalog은 추후 spec 저작과 검수의 evidence ledger입니다. 이 inventory만으로 어떤 diagram의 존재나 사람 승인을 주장하지 않습니다.

## Published diagrams

**4개.** 아래 결과물은 모두 `published`이고 `visual_review: passed`이며, 공통 조작 UI와 사용자 가시 설명을 한국어로 제공합니다. 제품별 수량은 Studio 1개, Career 1개, Suite 2개이며, 유형별 수량은 architecture 1개, workflow 2개, dataflow 1개입니다.

### `suite-plugin-system-architecture`

- 제품·유형·상태: `suite` · `architecture` · `published` (`visual_review: passed`)
- 답하는 질문: 사용자 진입점에서 두 기획 플러그인의 작업, 기준 기획 결과물, 자동 검증과 사람 검토·승인을 거쳐 결과가 어떻게 전달되는가?
- 원문 근거: 루트 `README.md`의 `플러그인 구조와 전체 시스템 아키텍처` 섹션
- 공개물: [한국어 게임 기획 플러그인 모음 전체 시스템 구조](../assets/archify/suite/suite-plugin-system-architecture.html)
- 명세·검증: [전체 시스템 구조 spec](specs/suite/suite-plugin-system-architecture.json) · [delivery receipt](../assets/archify/suite/suite-plugin-system-architecture.receipt.json) · [QA manifest](visual-qa/manifest.json)

### `studio-project-workflow`

- 제품·유형·상태: `studio` · `workflow` · `published` (`visual_review: passed`)
- 답하는 질문: 게임 비전부터 설계, 검토와 내보내기까지 Studio 작업을 어떤 순서로 확인하는가?
- 원문 근거: [Studio workflow source](specs/studio/studio-project-workflow.json)
- 공개물: [한국어 Studio 전체 프로젝트 워크플로](../assets/archify/studio/studio-project-workflow.html)
- 명세·검증: [Studio workflow spec](specs/studio/studio-project-workflow.json) · [delivery receipt](../assets/archify/studio/studio-project-workflow.receipt.json) · [QA manifest](visual-qa/manifest.json)

### `career-evidence-workflow`

- 제품·유형·상태: `career` · `workflow` · `published` (`visual_review: passed`)
- 답하는 질문: 역할 탐색, 학습 과제, 포트폴리오와 면접 준비를 어떤 검토 순서로 연결하는가?
- 원문 근거: [Career workflow source](specs/career/career-evidence-workflow.json)
- 공개물: [한국어 Career 증거·포트폴리오 워크플로](../assets/archify/career/career-evidence-workflow.html)
- 명세·검증: [Career workflow spec](specs/career/career-evidence-workflow.json) · [delivery receipt](../assets/archify/career/career-evidence-workflow.receipt.json) · [QA manifest](visual-qa/manifest.json)

### `suite-studio-career-handoff`

- 제품·유형·상태: `suite` · `dataflow` · `published` (`visual_review: passed`)
- 답하는 질문: 검토한 Studio 결과에서 공개 가능한 내용만 Career 포트폴리오와 면접 준비로 어떻게 인계하는가?
- 원문 근거: [Suite handoff source](specs/suite/suite-studio-career-handoff.json)
- 공개물: [한국어 Studio → Career 공개 근거 handoff](../assets/archify/suite/suite-studio-career-handoff.html)
- 명세·검증: [Suite handoff spec](specs/suite/suite-studio-career-handoff.json) · [delivery receipt](../assets/archify/suite/suite-studio-career-handoff.receipt.json) · [QA manifest](visual-qa/manifest.json)

## Blocked diagrams

**0개 (없음).** 현재 선택된 세 도식에는 남은 `blocked-*` 상태가 없습니다. 이후 source digest, Archify 검증 또는 시각 QA가 실패하면 공개 상태를 유지하지 않고 이 섹션에 차단 이유·증거·재시도 경계를 기록합니다.
