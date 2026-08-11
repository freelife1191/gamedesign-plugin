# 시스템 구조 도식 만들기

<a id="직접-호출-활용-archify"></a>

## 목적과 최종 산출물

`archify`는 게임 기획의 시스템 구조, 작업 흐름, 상태 전이, 데이터 흐름을 읽기 쉬운 한국어 HTML 도식으로 만듭니다. 결과는 검증된 JSON 원본, 대화형 HTML, 검증 영수증입니다.

## 사용할 때

기능 간 책임, 승인 단계, 상태 전이처럼 SVG 한 장보다 구조를 탐색하며 설명해야 할 때 사용합니다. 일반 기획 요청은 `orchestrate-game-design-project`가 필요 여부를 먼저 판단합니다.

## 사용하지 않을 때

단순 비교표, 확정되지 않은 수치, 캐릭터·배경 일러스트를 만들 때는 사용하지 않습니다.

## 필수 입력과 선택 입력

- 필수: 도식 목적, 독자, 사실로 확인한 구성 요소와 관계
- 선택: `architecture`, `workflow`, `sequence`, `dataflow`, `lifecycle` 유형, 강조할 검토 지점

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Studio 전투 보상 시스템의 구성 요소와 검토 흐름을 한국어 Archify HTML로 정리해. 확인된 사실과 아직 미정인 가정을 구분해.
```

## Codex CLI 요청 예시

```text
$game-design-studio:archify 전투 보상 시스템의 구성 요소와 검토 흐름을 한국어 architecture HTML로 정리하고 검증 영수증을 남겨.
```

## 내부 진행 흐름

도식 유형을 고르고, 현재 Artifact의 `content.md`와 근거를 읽은 뒤 JSON 원본을 작성합니다. `doctor`, `validate`, `deliver`를 통과한 HTML만 전달하며, 구조의 사실성은 `review-game-design`에서 별도로 검토합니다.

## 생성 파일과 결과 구조

`assets/` 아래 도식 JSON과 HTML, 검증 영수증을 남깁니다. 예상 결과는 설명용이며 사람 승인이나 구현 완료를 뜻하지 않습니다.

## 관련 템플릿·품질 프로필·전문 역할

현재 Artifact의 템플릿·품질 프로필을 그대로 따릅니다. 구조 의미는 [기획 검토 스킬](review-game-design.md)과 `lead-game-designer`가 확인합니다.

## 이미지·도식화 조건

구성 요소와 관계가 표보다 더 쉽게 이해될 때만 사용합니다. 인포그래픽 SVG는 [기획 도식 만들기](svg-infographic.md), 게임 이미지는 [이미지 자산 안내](../image-assets.md)를 사용합니다.

## 검토·승인 기준

각 노드와 연결은 확인 가능한 근거나 `미정` 표기를 가져야 합니다. HTML 생성·검증이 사람의 설계 승인이나 공개 승인을 대신하지 않습니다.

## 실패·fallback·재개 방법

검증이 실패하면 진단된 JSON 항목만 고치고 다시 검사합니다. 도식이 과밀하면 관계를 줄이거나 표로 되돌립니다.

## 다음 작업 요청문

자리표시자 `<artifact-path>`와 `<diagram-path>`은 실제 경로로 바꿉니다. [공통 규칙](../../README.md#용어)을 따릅니다.

```text
$game-design-studio:review-game-design artifact=<artifact-path> diagram=<diagram-path> 도식의 사실·미정·검토 경계를 확인해.
```

## 관련 문서

### 직접 호출 활용 — archify

아래 요청문은 현재 기획 결과 폴더의 사실 관계만 도식으로 설명합니다.

[Studio 스킬 선택표](README.md), [도식화 안내](../visualization.md), [전체 시스템 구조 HTML](../../assets/archify/suite/suite-plugin-system-architecture.html)
