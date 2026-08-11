---
title: 면접 질문·답변 기록
artifact_id: interview-question-answer-log
quality_profile: interview-question-answer-report
version: 1
---
# 면접 질문·답변 기록 {#interview-question-answer-log}

## 질문 목록 {#question-set}

기본 질문, 꼬리 질문, 반론 질문, 상황 질문마다 채용 공고 근거 ID(`posting-evidence-id`), 포트폴리오 근거 ID(`portfolio-evidence-id`) 또는 명시된 직무 공통 출처를 연결합니다.

## 사실에 근거한 답변 범위 {#honest-answer-boundary}

주장, 근거, 선택, 대안, 결과, 회고를 연결합니다. 팀 규모, 매출, 리텐션, 소유권, 구현 결과는 do-not-fabricate 원칙을 지킵니다. 뒷받침할 근거가 없으면 honest-answer와 검증 작업을 기록합니다.

## 작업 기록 {#working-record}

| 항목 ID | 현재 상태 | 근거 또는 다음 작업 | 담당자 |
| --- | --- | --- | --- |
| `question-id` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 함께 기록합니다. | artifact-owner |
| `question-type` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 함께 기록합니다. | artifact-owner |
| `posting-evidence-id` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 함께 기록합니다. | artifact-owner |
| `portfolio-evidence-id` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 함께 기록합니다. | artifact-owner |
| `answer-status` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 함께 기록합니다. | artifact-owner |
| `honest-answer` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 함께 기록합니다. | artifact-owner |
| `verification-task` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 함께 기록합니다. | artifact-owner |

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
