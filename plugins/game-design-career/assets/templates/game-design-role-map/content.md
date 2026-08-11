---
title: 게임 기획 직무 지도
artifact_id: game-design-role-map
quality_profile: career-stage-role-map
version: 1
---
# 게임 기획 직무 지도 {#game-design-role-map}

## 직무군과 선택 기준 {#role-families-and-tradeoffs}

각 직무군(`role-family`)에 목표 레벨, 현재 근거(`current-evidence`), 역량 차이, 선택 기준, 학습 과제, 피드백 주기, 증빙 산출물(`proof-artifact`)을 기록합니다.

## 가설 단계의 경로 {#provisional-paths}

목표가 불분명하면 가능성 있는 경로를 적어도 두 개 남깁니다. 나이, 학력, 전공, 공백 기간으로 순위를 매기지 않습니다.

## 작업 기록 {#working-record}

| 항목 ID | 현재 상태 | 근거 또는 다음 작업 | 담당자 |
| --- | --- | --- | --- |
| `role-family` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 함께 기록합니다. | artifact-owner |
| `current-evidence` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 함께 기록합니다. | artifact-owner |
| `target-level` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 함께 기록합니다. | artifact-owner |
| `gap` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 함께 기록합니다. | artifact-owner |
| `learning-task` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 함께 기록합니다. | artifact-owner |
| `feedback-cadence` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 함께 기록합니다. | artifact-owner |
| `proof-artifact` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 함께 기록합니다. | artifact-owner |
| `tradeoff` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 함께 기록합니다. | artifact-owner |

## 전제와 범위 {#assumptions-and-boundaries}

각 전제는 안정적인 ID, 근거 상태, 담당자, 검증 작업, 아직 결정을 막고 있는 사유와 함께 기록합니다. 전제는 승인된 사실이 아닙니다.

## 담당자와 승인 {#owners-and-approvals}

산출물 담당자, 근거 검토자, 공개 또는 개인정보 승인 담당자(해당하는 경우), 승인 상태, 승인일, 재검토 조건을 기록합니다. 자동화 도구는 승인이나 권한을 부여할 수 없습니다.

## 근거와 최신성 {#evidence-and-freshness}

주요 주장에는 `evidence.yml`의 근거를 연결합니다. 근거는 상시 유효, 맥락 의존, 시점 민감으로 구분합니다. 최신 주장은 날짜가 있는 1차 출처, 조회일, 지역 또는 적용 범위, 재검토일, 갱신 담당자를 갖춰야 합니다. 제3자 자료에는 출처, 출처 표기, 이용 목적, 권리 또는 인용 유의사항, 개인정보 처리 방침도 기록합니다.

## 산출물 구성 가이드 {#output-story-hints}

Markdown 원본에는 전체 의사결정 기록을 남깁니다. PDF와 DOCX도 같은 계층을 유지합니다. PPTX는 청중에 맞춰 맥락과 결정, 근거와 대안, 결과 또는 미해결 검증 작업 순으로 짧게 구성합니다. Markdown을 제목 단위로 기계적으로 나누지 마세요.

## 첨부 자료 {#assets}

근거가 확보된 뒤 첫 번째 다이어그램을 추가할 수 있습니다. `assets/`에는 상대 경로의 로컬 파일만 보관하고, 비어 있지 않은 대체 텍스트를 작성합니다. 출처와 권리는 `assets/README.md`에 기록합니다.

## 의사결정 {#decisions}

`decisions/`에 지속해서 참고할 범위, 근거, 공개 관련 결정을 기록합니다. 각 결정에는 대안, 근거, 담당자, 승인 상태, 재검토 조건을 포함합니다.

## 변경 이력 {#change-history}

| 버전 | 날짜 | 담당자 | 변경 내용 | 승인 |
| --- | --- | --- | --- | --- |
| 1 | 2026-08-04 | artifact-owner | 검토 가능한 초안과 완료 범위를 만들었습니다. | pending human review |
