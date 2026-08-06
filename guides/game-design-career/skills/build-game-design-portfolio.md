# build-game-design-portfolio

## 목적과 최종 산출물

프로젝트의 문제·판단·실험·협업·결과를 recruiter가 독립적으로 검사할 수 있는 portfolio case study와 claim-to-evidence index로 구성합니다.

## 사용할 때

- 흩어진 기획 문서와 피드백을 목표 역량 중심 case study로 묶을 때
- 팀 결과와 개인 기여, 검증된 결과와 회고를 분리해야 할 때

## 사용하지 않을 때

- 근거 없는 성과를 매끄러운 서사로 보충할 때
- 완성된 portfolio의 5축 finding만 필요하면 `review-game-design-portfolio`를 사용합니다.

## 필수 입력과 선택 입력

- 필수: target competency, intended reviewer, material claims, 개인·팀 attribution, evidence address, rights/privacy 범위
- 선택: prototype, playtest, implementation handoff, decision log, annotated image
- 각 claim에는 stable `claimId`, provenance, strength, status, recovery owner/action과 `inspectabilityGate`가 필요합니다.

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Career 이 제작 시스템 프로젝트를 recruiter용 case study로 구성해. 내 결정, 대안, 테스트와 협업 기여를 evidence ID로 연결하고 확인할 수 없는 결과는 gap으로 남겨 줘.
```

## Codex CLI 요청 예시

```text
$game-design-career:build-game-design-portfolio targetCompetency=system-design, reviewer=recruiter, source=artifacts/crafting-project
```

## 내부 진행 흐름

`target competency → problem/user → evidence → hypothesis/intent → rules·UI·data·content → constraints/alternatives → implementation/test → result/decision → retrospective` 순서를 지킵니다. 사실, 참여자 진술, 해석과 unsupported claim을 나누고 팀·개인 소유를 별도 표시합니다.

## 생성 파일과 결과 구조

`creative-design-portfolio` 또는 `portfolio-project-brief`의 `content.md`, claim-evidence index, attribution/rights notes, recovery queue와 reviewer checklist를 만듭니다. 예상 결과 요약: 설명 없이도 핵심 역량과 증거를 찾을 수 있는 case study가 생깁니다.

## 관련 템플릿·품질 프로필·전문 역할

기존 Artifact의 템플릿과 선택된 Quality Profile을 그대로 사용하고, 필요 시 관련 전문 역할의 finding을 evidence와 decision record에 연결합니다. 시작점은 [템플릿 카탈로그](../templates.md)와 [문서 품질 프로필](../document-quality.md)입니다.

## 이미지·도식화 조건

템플릿의 image slot이 실제로 필요할 때만 [이미지 자산 흐름](../image-assets.md)으로 계획·생성을 분리합니다. 관계·흐름·상태를 보여 줄 때는 일반 삽화 대신 [Skillstead 도식화](../visualization.md)를 사용하며, 둘 다 필요 없으면 만들지 않습니다.

## 검토·승인 기준

visual polish는 역량 증거가 아닙니다. source URL, section anchor, file/version, test record나 annotated image로 material claim을 찾을 수 있어야 하며 공개 전 권리·privacy owner가 결정합니다. portfolio가 합격을 보장하지 않습니다.

## 실패·fallback·재개 방법

essential claim이 `inspectabilityGate`를 통과하지 못하면 incomplete로 유지하고 `strength: none`, `status: missing`, recovery owner와 action을 같은 record에 남깁니다.

```text
$game-design-career:build-game-design-portfolio 기존 claimId를 유지하고 missing인 테스트 결과만 새 evidence address에 연결해 재개해.
```

## 다음 작업 요청문

**복사 가능한 CLI 후속 요청문**

```text
$game-design-career:build-game-design-portfolio 기존 Canonical Artifact와 decision/evidence 기록을 유지하고, 현재 blocker 또는 미확정 항목만 확인해 다음 검토 가능한 작업을 진행해.
```

## 관련 문서

[스킬 선택표](README.md), [템플릿 카탈로그](../templates.md), [문서 품질](../document-quality.md), [제품 workflow](../workflow.md)
