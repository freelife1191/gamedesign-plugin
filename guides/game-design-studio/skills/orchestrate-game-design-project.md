# orchestrate-game-design-project

## 목적과 산출물

신규 모바일 협동 RPG처럼 여러 영역이 섞인 요청을 bounded brief, 최소 스킬 체인, Canonical Artifact와 완료 게이트로 라우팅합니다.

## 사용할 때

- 비전, 시스템, 콘텐츠, UX, 경제와 생산 범위가 함께 필요할 때
- intent가 불명확하거나 launch readiness 조정이 필요할 때

## 사용하지 않을 때

- 목적이 한 영역으로 확정되었으면 해당 specialist skill을 직접 사용합니다.
- 알려지지 않은 intent를 임의 specialist로 추측하지 않습니다.

## 필수 입력과 선택 입력

- 필수: 게임 아이디어, 목표 산출물, 대상, 결정 owner, 알려진 제약
- 선택: 기존 artifact, 원하는 형식, 이미지 요구, 검토 질문, 출시 gate
- 안전한 가정은 표시하고 결과를 바꾸는 질문만 남깁니다.

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Studio 신규 모바일 4인 협동 RPG의 전체 기획을 라우팅해. vision, 핵심 시스템, 첫 세션, 경제, vertical slice와 검토 gate를 하나의 Canonical Artifact 체계로 연결해.
```

## Codex CLI 예시

```text
$game-design-studio:orchestrate-game-design-project 신규 모바일 협동 RPG의 brief, 최소 domain routes, artifact/profile, 최대 3개 review role과 completion gate를 정해.
```

## 진행 흐름

intake를 정리하고 exact route와 artifact를 고른 뒤 각 artifact에 quality profile을 적용합니다. 필요하면 이미지 계획을 생성보다 먼저 실행하고 최대 3개 역할 finding을 결정적으로 병합합니다. 주 템플릿/profile은 `game-design-brief`/`game-design-brief`, 관련 역할은 `lead-game-designer`를 포함한 범위별 최대 3개, 다음 스킬은 선택된 첫 domain skill입니다.

## 결과와 파일

Canonical Artifact의 `content.md`, `evidence.yml`, `decisions/`, `assets/`, `export-manifest.yml`과 route·role·gate·next owner를 기록합니다. 예상 결과 요약: 복합 요청이 검증 가능한 순서와 책임 경계로 나뉩니다.

## 검토와 승인

가정, 미해결 질문, blocked gate, capability 부재를 그대로 보고합니다. profile은 질문과 gate를 추가할 뿐 사실을 발명하지 않으며, 모든 applicable gate는 승인되거나 명시적으로 blocked여야 합니다.

## 실패와 재개

optional review, visualization, image 또는 export가 실패해도 canonical Markdown과 통과한 증거를 보존합니다.

```text
$game-design-studio:orchestrate-game-design-project 기존 Canonical Artifact와 route 기록을 유지하고, blocked gate와 실패한 optional 단계만 마지막 검증 증거부터 재개해.
```
