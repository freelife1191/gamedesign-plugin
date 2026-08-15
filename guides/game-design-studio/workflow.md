# Game Design Studio 전체 워크플로

Studio는 기준 Markdown을 먼저 만들고 선택 기능을 뒤에 붙입니다. 권장 순서는 다음과 같습니다.

[한국어 Archify 전체 프로젝트 워크플로 열기](../assets/archify/studio/studio-project-workflow.html)

각 작업은 현재 프로젝트에서 승인된 Studio·공통 기억을 먼저 조회하되 출처가 달라졌거나 검토·만료 시점을 지난 기록은 제외합니다. 경쟁작이나 장르 관습이 필요하면 [레퍼런스 분석](reference-analysis.md)으로 관찰과 추론을 분리하고, 문서 용어가 흔들리면 [용어 사전](glossary.md)으로 후보와 영향 범위를 검토합니다. 결과를 검증한 뒤에는 재사용 가치가 있는 교훈만 후보로 남기며 자동 승인하지 않습니다. 기억을 끄거나 조회·저장에 문제가 생기면 아래 워크플로는 기억 없이 그대로 진행됩니다. 설정과 관리 방법은 [Studio 프로젝트 기억](memory.md)을 확인하세요.

```text
비전
→ 승인된 기억·레퍼런스·용어 확인
→ 시스템·콘텐츠·UX·경제·제작
→ 전문 검토
→ 이미지·도식 자산
→ MD/PDF/DOCX/PPTX 내보내기
```

[![Canonical Artifact 승인 흐름](../assets/shared/canonical-artifact-lifecycle.png)](../assets/shared/canonical-artifact-lifecycle.svg)

## 1. 비전

대상 플레이어, 핵심 재미, 기획 의도, 세 가지 안팎의 설계 원칙, 이번에 다루지 않을 목표와 검증 기준을 정합니다. 입력이 부족하면 가정과 미확정 결정을 분리한 기획 요약서를 먼저 만듭니다.

**사람 결정:** 어떤 플레이어 경험을 최우선으로 두고 무엇을 만들지 않을지 승인합니다.

## 2. 시스템·콘텐츠·UX·경제·제작

비전을 기준으로 필요한 도메인만 순서대로 확장합니다.

| 도메인 | 다루는 내용 | 다음 단계로 넘길 기준 |
| --- | --- | --- |
| 시스템 | 규칙, 상태, 예외, 데이터와 의존성 | 정상·예외 흐름과 검증 기준이 연결됨 |
| 콘텐츠 | 내러티브, 퀘스트, NPC, 전투와 제작 비용 | 시스템 데이터와 제작 범위가 연결됨 |
| 플레이어 경험 | 여정, UI/UX, 온보딩, 접근성, 플랫폼 제약 | 실패·복구 상태와 접근성 위험이 보임 |
| 경제·LiveOps | source/sink, 밸런스 가설, 실험과 rollback | 근거 없는 수치가 가정으로 표시됨 |
| 제작 | 범위, 마일스톤, 의존성, 리스크와 책임자 | hard No-Go와 승인 owner가 분리됨 |

병렬로 작성해도 결과를 합칠 때는 Canonical Artifact의 안정적인 섹션과 결정 기록을 기준으로 충돌을 보존합니다.

경쟁작 분석 결과는 정답이 아니라 관찰 근거와 `adopt`, `adapt`, `reject`, `hold` 제안입니다. 용어 후보도 자동 치환하지 않으며, 이름이 기록된 사람이 한국어·영어 선호 표현과 문서 범위를 승인한 뒤 별도 수정안에 반영합니다.

## 3. 검토

요청 범위에 필요한 전문 역할만 선택해 품질, 실행 가능성, 접근성, 경제, 근거와 책임 있는 설계를 검토합니다. 충돌하는 권고는 한쪽을 지우지 않고 결정 항목으로 남깁니다.

**사람 결정:** 차단 finding을 수용, 수정, 예외 승인 또는 보류합니다. 누락 근거와 사람 결정은 AI가 승인으로 바꾸지 않습니다.

## 4. 자산

이미지와 구조적 도식을 구분합니다.

- 이미지: Quality Profile 뒤에 `plan-image-assets`로 stable asset ID와 prompt를 만들고, 설정된 provider로만 생성한 뒤 `review-image-assets`에서 사람이 승인합니다.
- 컷씬: [컷씬 비주얼 프리프로덕션](cutscene-visual-preproduction.md)에서 `style-master → reference-masters → keyframes → storyboard`를 직렬로 진행합니다. 각 wave는 비용 공개와 이름을 기록한 승인 전까지 provider 호출 0회입니다.
- 도식: 흐름, 상태, 루프와 의존성은 Skillstead SVG로 만들고 Chromium이 있으면 정확한 2× PNG를 렌더합니다. SVG lint와 시각 QA 전에는 검증 완료가 아닙니다.

선택 capability가 없으면 prompt, placeholder, SVG 원본 또는 기존 검증 자산을 보존하고 해당 단계만 차단합니다.

## 5. 내보내기

`content.md`를 내용 기준으로 MD, PDF, DOCX 또는 PPTX 작업을 준비합니다. MD는 renderer가 없어도 유지할 수 있지만, PDF·DOCX·PPTX는 해당 renderer와 형식별 QA 근거가 필요합니다. 생성 파일이 있다는 이유만으로 성공 또는 승인을 선언하지 않습니다.

## 재개 계약

중단할 때 다음을 보존합니다.

- Canonical Artifact 경로와 버전
- 완료된 섹션과 검증된 자산
- `pending`, `blocked`, `unavailable` 상태와 원인
- 필요한 capability, 근거 또는 사람 결정
- 다음 단일 작업 요청문

재개할 때는 새 문서를 처음부터 만들지 말고 Artifact 경로와 차단 항목을 지정합니다.

```text
mobile-coop-rpg-brief/content.md를 기준으로 보존된 결정을 유지하고, blocked인 이미지 승인 단계부터 재개해줘.
```
