# Game Design Career 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: career:visualize-career-roadmap:beginner -->
## career:visualize-career-roadmap:beginner

**게임 기획 역할 비교 흐름도**

역할군과 인접 경로의 차이를 source-mapped structural workflow로 표현하고 사실·추론·제안을 분리한다.

### 간단 요청 예시
```text
@Game Design Career career/sample-artifact, sample-input, [source IDs], [audience]를 사용해 역할 비교 흐름 시각화를 수행해. Archify가 available이면 structural workflow를 우선한다. Archify absence 또는 failure면 Skillstead editable SVG와 exact 2× PNG fallback을 사용하고 source receipt와 render receipt를 분리한다. fallback을 Archify 결과로 표시하지 않으며 Skillstead 자동 승인하지 않는다. lint 0 warning/error, exact 2× PNG, accessibility title·desc·adjacent alt text, fit-to-page·close-up QA와 human approval을 각각 evidence로 기록한다.
```

### 짧은 흐름
- 작업 순서: map-game-design-career → visualize-career-roadmap
- 함께 검토하는 역할: career-strategist → game-design-mentor

### 이 요청으로 받는 결과
관심사에서 시스템 기획과 레벨 기획으로 갈라지고 각 역할의 첫 연습 과제로 이어지는 흐름도를 만들었습니다. 연결선은 역할 지도 초안에 근거하며 멘토 확인 전에는 진로 추천으로 보지 않습니다. (ID: career:visualize-career-roadmap:beginner; 파일: career/visual/visualize-career-roadmap/beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
역할 비교 흐름 시각화에 필요한 실제 artifact와 검토 경계를 갖췄을 때 사용한다.

### 사용하지 않는 경우
사실이 아닌 경력·기여·권리·승인을 만들어 내거나 채용·공개를 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- [role families]
- [source IDs]
- [audience]
- source·attribution 또는 미정 기록
- owner

#### 선택 입력
- dimensions
- accessibility intent
- existing evidence path

### 바꿀 자리표시자
- [Canonical Artifact]
- [role families]
- [source IDs]
- [audience]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [Canonical Artifact], [role families], [source IDs], [audience]를 사용해 역할 비교 흐름 시각화를 수행해. Archify가 available이면 structural workflow를 우선한다. Archify absence 또는 failure면 Skillstead editable SVG와 exact 2× PNG fallback을 사용하고 source receipt와 render receipt를 분리한다. fallback을 Archify 결과로 표시하지 않으며 Skillstead 자동 승인하지 않는다. lint 0 warning/error, exact 2× PNG, accessibility title·desc·adjacent alt text, fit-to-page·close-up QA와 human approval을 각각 evidence로 기록한다.
```

### Codex CLI 완성 예시
```text
$game-design-career:visualize-career-roadmap artifact=career/sample-artifact inputs="sample-input, [source IDs], [audience]" 역할 비교 흐름 시각화를 수행해. Archify가 available이면 structural workflow를 우선한다. Archify absence 또는 failure면 Skillstead editable SVG와 exact 2× PNG fallback을 사용하고 source receipt와 render receipt를 분리한다. fallback을 Archify 결과로 표시하지 않으며 Skillstead 자동 승인하지 않는다. lint 0 warning/error, exact 2× PNG, accessibility title·desc·adjacent alt text, fit-to-page·close-up QA와 human approval을 각각 evidence로 기록한다.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:visualize-career-roadmap artifact=[Canonical Artifact] inputs="[role families], [source IDs], [audience]" 역할 비교 흐름 시각화를 수행해. Archify가 available이면 structural workflow를 우선한다. Archify absence 또는 failure면 Skillstead editable SVG와 exact 2× PNG fallback을 사용하고 source receipt와 render receipt를 분리한다. fallback을 Archify 결과로 표시하지 않으며 Skillstead 자동 승인하지 않는다. lint 0 warning/error, exact 2× PNG, accessibility title·desc·adjacent alt text, fit-to-page·close-up QA와 human approval을 각각 evidence로 기록한다.
```

### 스킬·전문 역할 흐름
- 기본 스킬: visualize-career-roadmap
- 스킬 흐름: map-game-design-career → visualize-career-roadmap
- 전문 역할: career-strategist → game-design-mentor

### 중간 산출물
- game-design-role-map

### 예상 결과물
#### 최소 결과물
- selectedPresetId·rationale·excluded presets
- source-mapped relationship record
- SVG/PNG state and separated receipts
- resumable QA handoff

#### 선택 결과물
- unresolved blocker
- alternative presentation

#### 확장 결과물
- evidence.yml receipt
- review handoff
- resumable next action

### 파일 구조
- career/visual/visualize-career-roadmap/beginner/content.md
- career/visual/visualize-career-roadmap/beginner/evidence.yml
- career/visual/visualize-career-roadmap/beginner/export-manifest.yml
- career/visual/visualize-career-roadmap/beginner/assets/README.md

### 읽는 순서
- career/visual/visualize-career-roadmap/beginner/content.md
- career/visual/visualize-career-roadmap/beginner/evidence.yml
- career/visual/visualize-career-roadmap/beginner/export-manifest.yml
- career/visual/visualize-career-roadmap/beginner/assets/README.md

### 도식 바인딩
- ID: ca-s15
- SVG: guides/assets/game-design-career/skills/visualize-career-roadmap.svg
- PNG: guides/assets/game-design-career/skills/visualize-career-roadmap.png
- 대체 텍스트: 게임 기획 커리어 로드맵 시각화 직접 호출 흐름

### 사람 검토
#### 승인 경계
game-design-mentor owner가 source mapping, receipt와 visual QA를 승인·수정·보류한다. 도식 QA는 portfolio publication 또는 document approval이 아니다.

#### 보류 조건
- source ID 또는 selected preset이 미정
- lint/render/receipt evidence가 없음
- human approval 또는 accessibility evidence가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청·공개하지 않는다. attribution과 source가 없으면 공개 권리도 미정으로 보류한다.

### 실패와 재개
```text
visualize-career-roadmap/beginner의 canonical artifact, stable IDs, source·attribution, existing receipt와 unresolved blocker를 보존하고 확정된 owner evidence만 반영해 마지막 안전한 단계부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:visualize-career-roadmap:standard -->
## career:visualize-career-roadmap:standard

**역량의 선후 관계와 증거를 잇는 지도**

역량 dependency와 proof evidence를 숫자나 진척률을 발명하지 않고 editable diagram으로 연결한다.

### 간단 요청 예시
```text
@Game Design Career career/sample-artifact, sample-input, [evidence IDs], [selected preset]를 사용해 역량 dependency와 evidence map를 수행해. Archify가 available이면 structural workflow를 우선한다. Archify absence 또는 failure면 Skillstead editable SVG와 exact 2× PNG fallback을 사용하고 source receipt와 render receipt를 분리한다. fallback을 Archify 결과로 표시하지 않으며 Skillstead 자동 승인하지 않는다. lint 0 warning/error, exact 2× PNG, accessibility title·desc·adjacent alt text, fit-to-page·close-up QA와 human approval을 각각 evidence로 기록한다.
```

### 짧은 흐름
- 작업 순서: map-game-design-career → visualize-career-roadmap → svg-infographic
- 함께 검토하는 역할: career-strategist → game-design-mentor

### 이 요청으로 받는 결과
규칙 모델링을 먼저 익혀야 경제 시뮬레이션 과제를 시작할 수 있도록 선후 관계를 표시했습니다. 각 역량 옆에는 현재 문서 근거와 빈 증거를 함께 두었으며 관계의 타당성은 멘토 검토 전입니다. (ID: career:visualize-career-roadmap:standard; 파일: career/visual/visualize-career-roadmap/standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
역량 dependency와 evidence map에 필요한 실제 artifact와 검토 경계를 갖췄을 때 사용한다.

### 사용하지 않는 경우
사실이 아닌 경력·기여·권리·승인을 만들어 내거나 채용·공개를 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- [competency dependency]
- [evidence IDs]
- [selected preset]
- source·attribution 또는 미정 기록
- owner

#### 선택 입력
- dimensions
- accessibility intent
- existing evidence path

### 바꿀 자리표시자
- [Canonical Artifact]
- [competency dependency]
- [evidence IDs]
- [selected preset]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [Canonical Artifact], [competency dependency], [evidence IDs], [selected preset]를 사용해 역량 dependency와 evidence map를 수행해. Archify가 available이면 structural workflow를 우선한다. Archify absence 또는 failure면 Skillstead editable SVG와 exact 2× PNG fallback을 사용하고 source receipt와 render receipt를 분리한다. fallback을 Archify 결과로 표시하지 않으며 Skillstead 자동 승인하지 않는다. lint 0 warning/error, exact 2× PNG, accessibility title·desc·adjacent alt text, fit-to-page·close-up QA와 human approval을 각각 evidence로 기록한다.
```

### Codex CLI 완성 예시
```text
$game-design-career:visualize-career-roadmap artifact=career/sample-artifact inputs="sample-input, [evidence IDs], [selected preset]" 역량 dependency와 evidence map를 수행해. Archify가 available이면 structural workflow를 우선한다. Archify absence 또는 failure면 Skillstead editable SVG와 exact 2× PNG fallback을 사용하고 source receipt와 render receipt를 분리한다. fallback을 Archify 결과로 표시하지 않으며 Skillstead 자동 승인하지 않는다. lint 0 warning/error, exact 2× PNG, accessibility title·desc·adjacent alt text, fit-to-page·close-up QA와 human approval을 각각 evidence로 기록한다.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:visualize-career-roadmap artifact=[Canonical Artifact] inputs="[competency dependency], [evidence IDs], [selected preset]" 역량 dependency와 evidence map를 수행해. Archify가 available이면 structural workflow를 우선한다. Archify absence 또는 failure면 Skillstead editable SVG와 exact 2× PNG fallback을 사용하고 source receipt와 render receipt를 분리한다. fallback을 Archify 결과로 표시하지 않으며 Skillstead 자동 승인하지 않는다. lint 0 warning/error, exact 2× PNG, accessibility title·desc·adjacent alt text, fit-to-page·close-up QA와 human approval을 각각 evidence로 기록한다.
```

### 스킬·전문 역할 흐름
- 기본 스킬: visualize-career-roadmap
- 스킬 흐름: map-game-design-career → visualize-career-roadmap → svg-infographic
- 전문 역할: career-strategist → game-design-mentor

### 중간 산출물
- competency-matrix

### 예상 결과물
#### 최소 결과물
- selectedPresetId·rationale·excluded presets
- source-mapped relationship record
- SVG/PNG state and separated receipts
- resumable QA handoff

#### 선택 결과물
- unresolved blocker
- alternative presentation

#### 확장 결과물
- evidence.yml receipt
- review handoff
- resumable next action

### 파일 구조
- career/visual/visualize-career-roadmap/standard/content.md
- career/visual/visualize-career-roadmap/standard/evidence.yml
- career/visual/visualize-career-roadmap/standard/export-manifest.yml
- career/visual/visualize-career-roadmap/standard/assets/README.md

### 읽는 순서
- career/visual/visualize-career-roadmap/standard/content.md
- career/visual/visualize-career-roadmap/standard/evidence.yml
- career/visual/visualize-career-roadmap/standard/export-manifest.yml
- career/visual/visualize-career-roadmap/standard/assets/README.md

### 도식 바인딩
- ID: ca-s15
- SVG: guides/assets/game-design-career/skills/visualize-career-roadmap.svg
- PNG: guides/assets/game-design-career/skills/visualize-career-roadmap.png
- 대체 텍스트: 게임 기획 커리어 로드맵 시각화 직접 호출 흐름

### 사람 검토
#### 승인 경계
game-design-mentor owner가 source mapping, receipt와 visual QA를 승인·수정·보류한다. 도식 QA는 portfolio publication 또는 document approval이 아니다.

#### 보류 조건
- source ID 또는 selected preset이 미정
- lint/render/receipt evidence가 없음
- human approval 또는 accessibility evidence가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청·공개하지 않는다. attribution과 source가 없으면 공개 권리도 미정으로 보류한다.

### 실패와 재개
```text
visualize-career-roadmap/standard의 canonical artifact, stable IDs, source·attribution, existing receipt와 unresolved blocker를 보존하고 확정된 owner evidence만 반영해 마지막 안전한 단계부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:visualize-career-roadmap:advanced -->
## career:visualize-career-roadmap:advanced

**진로 로드맵의 우선 구성과 대체 경로 (Archify)**

Archify가 available이면 structural workflow를 우선하고 absence/failure에서는 Skillstead editable SVG와 exact 2× PNG fallback 및 분리된 receipt를 기록한다.

### 간단 요청 예시
```text
@Game Design Career career/sample-artifact, sample-input, [Archify capability state], [human approval owner]를 사용해 Archify 우선 로드맵 fallback·receipt를 수행해. Archify가 available이면 structural workflow를 우선한다. Archify absence 또는 failure면 Skillstead editable SVG와 exact 2× PNG fallback을 사용하고 source receipt와 render receipt를 분리한다. fallback을 Archify 결과로 표시하지 않으며 Skillstead 자동 승인하지 않는다. lint 0 warning/error, exact 2× PNG, accessibility title·desc·adjacent alt text, fit-to-page·close-up QA와 human approval을 각각 evidence로 기록한다.
```

### 짧은 흐름
- 작업 순서: visualize-career-roadmap → svg-infographic
- 함께 검토하는 역할: career-strategist → game-design-mentor

### 이 요청으로 받는 결과
관계가 많은 12주 로드맵에는 Archify 구성을 우선 선택하고 제외한 두 형식의 이유도 적었습니다. 렌더링이 실패하면 정적 벡터 도식(SVG)으로 넘기는 경로가 있으며 최종 도식은 시각 검토가 필요합니다. (ID: career:visualize-career-roadmap:advanced; 파일: career/visual/visualize-career-roadmap/advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
Archify 우선 로드맵 fallback·receipt에 필요한 실제 artifact와 검토 경계를 갖췄을 때 사용한다.

### 사용하지 않는 경우
사실이 아닌 경력·기여·권리·승인을 만들어 내거나 채용·공개를 보장할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- Canonical Artifact
- [relationship]
- [Archify capability state]
- [human approval owner]
- source·attribution 또는 미정 기록
- owner

#### 선택 입력
- dimensions
- accessibility intent
- existing evidence path

### 바꿀 자리표시자
- [Canonical Artifact]
- [relationship]
- [Archify capability state]
- [human approval owner]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [Canonical Artifact], [relationship], [Archify capability state], [human approval owner]를 사용해 Archify 우선 로드맵 fallback·receipt를 수행해. Archify가 available이면 structural workflow를 우선한다. Archify absence 또는 failure면 Skillstead editable SVG와 exact 2× PNG fallback을 사용하고 source receipt와 render receipt를 분리한다. fallback을 Archify 결과로 표시하지 않으며 Skillstead 자동 승인하지 않는다. lint 0 warning/error, exact 2× PNG, accessibility title·desc·adjacent alt text, fit-to-page·close-up QA와 human approval을 각각 evidence로 기록한다.
```

### Codex CLI 완성 예시
```text
$game-design-career:visualize-career-roadmap artifact=career/sample-artifact inputs="sample-input, [Archify capability state], [human approval owner]" Archify 우선 로드맵 fallback·receipt를 수행해. Archify가 available이면 structural workflow를 우선한다. Archify absence 또는 failure면 Skillstead editable SVG와 exact 2× PNG fallback을 사용하고 source receipt와 render receipt를 분리한다. fallback을 Archify 결과로 표시하지 않으며 Skillstead 자동 승인하지 않는다. lint 0 warning/error, exact 2× PNG, accessibility title·desc·adjacent alt text, fit-to-page·close-up QA와 human approval을 각각 evidence로 기록한다.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:visualize-career-roadmap artifact=[Canonical Artifact] inputs="[relationship], [Archify capability state], [human approval owner]" Archify 우선 로드맵 fallback·receipt를 수행해. Archify가 available이면 structural workflow를 우선한다. Archify absence 또는 failure면 Skillstead editable SVG와 exact 2× PNG fallback을 사용하고 source receipt와 render receipt를 분리한다. fallback을 Archify 결과로 표시하지 않으며 Skillstead 자동 승인하지 않는다. lint 0 warning/error, exact 2× PNG, accessibility title·desc·adjacent alt text, fit-to-page·close-up QA와 human approval을 각각 evidence로 기록한다.
```

### 스킬·전문 역할 흐름
- 기본 스킬: visualize-career-roadmap
- 스킬 흐름: visualize-career-roadmap → svg-infographic
- 전문 역할: career-strategist → game-design-mentor

### 중간 산출물
- learning-roadmap

### 예상 결과물
#### 최소 결과물
- selectedPresetId·rationale·excluded presets
- source-mapped relationship record
- SVG/PNG state and separated receipts
- resumable QA handoff

#### 선택 결과물
- unresolved blocker
- alternative presentation

#### 확장 결과물
- evidence.yml receipt
- review handoff
- resumable next action

### 파일 구조
- career/visual/visualize-career-roadmap/advanced/content.md
- career/visual/visualize-career-roadmap/advanced/evidence.yml
- career/visual/visualize-career-roadmap/advanced/export-manifest.yml
- career/visual/visualize-career-roadmap/advanced/assets/README.md

### 읽는 순서
- career/visual/visualize-career-roadmap/advanced/content.md
- career/visual/visualize-career-roadmap/advanced/evidence.yml
- career/visual/visualize-career-roadmap/advanced/export-manifest.yml
- career/visual/visualize-career-roadmap/advanced/assets/README.md

### 도식 바인딩
- ID: ca-s15
- SVG: guides/assets/game-design-career/skills/visualize-career-roadmap.svg
- PNG: guides/assets/game-design-career/skills/visualize-career-roadmap.png
- 대체 텍스트: 게임 기획 커리어 로드맵 시각화 직접 호출 흐름

### 사람 검토
#### 승인 경계
game-design-mentor owner가 source mapping, receipt와 human approval를 승인·수정·보류한다. 도식 QA는 portfolio publication 또는 document approval이 아니다.

#### 보류 조건
- source ID 또는 selected preset이 미정
- lint/render/receipt evidence가 없음
- human approval 또는 accessibility evidence가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청·공개하지 않는다. attribution과 source가 없으면 공개 권리도 미정으로 보류한다.

### 실패와 재개
```text
visualize-career-roadmap/advanced의 canonical artifact, stable IDs, source·attribution, existing receipt와 unresolved blocker를 보존하고 확정된 owner evidence만 반영해 마지막 안전한 단계부터 재개해.
```

</details>
