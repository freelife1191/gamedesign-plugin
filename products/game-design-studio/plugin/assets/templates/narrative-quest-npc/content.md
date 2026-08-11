---
title: 내러티브·퀘스트·NPC
artifact_id: narrative-quest-npc
quality_profile: narrative-quest-npc-specification
version: 1
---
# 내러티브·퀘스트·NPC {#narrative-quest-npc}

## 내러티브 콘텐츠 명세 {#narrative-content-contract}

각 content-id에 플레이어 목적, 시스템 입력, 제작 리소스, 진입 조건, 선택과 결과, 퀘스트 상태, NPC 상태, 텔레그래프, 결과, 보상, 반복 가능 여부, 담당자를 연결한다.

## AI·UGC 권리 경계 {#ai-and-ugc-rights-boundary}

AI 생성·출연자 유래·사용자 생성 자료를 사용할 때는 출시 전에 출처, 제작자 또는 기여자, 출처 표기, 사용 목적, 권리 또는 동의, 개인정보, 모더레이션, 승인자, 철회 경로를 기록한다.

## 작성 기록 {#working-record}

| 항목 ID | 상태 | 근거 또는 다음 작업 | 담당자 |
| --- | --- | --- | --- |
| `content-id` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 기록한다. | artifact-owner |
| `player-purpose` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 기록한다. | artifact-owner |
| `entry-condition` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 기록한다. | artifact-owner |
| `choice-consequence` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 기록한다. | artifact-owner |
| `quest-state` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 기록한다. | artifact-owner |
| `npc-state` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 기록한다. | artifact-owner |
| `telegraph` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 기록한다. | artifact-owner |
| `reward` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 기록한다. | artifact-owner |
| `repeatability` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 기록한다. | artifact-owner |
| `rights-consent` | not-observed | 승인 전에 프로젝트별 값과 근거 위치를 기록한다. | artifact-owner |

## 가정과 범위 {#assumptions-and-boundaries}

각 가정에는 안정 ID, 근거 상태, 담당자, 검증 작업, 영향받는 결정, 만료일 또는 재검토일을 기록한다. 가정은 승인된 사실이 아니다.

## 담당자 및 승인 {#owners-and-approvals}

산출물 담당자, 근거 검토자, 직군별 승인자, 해당 시 플레이어 안전 또는 접근성 검토자, 승인 상태·일자·재개 조건을 기록한다. 자동화는 승인·권리 부여·동의를 대신할 수 없다.

## 근거와 최신성 {#evidence-and-freshness}

중요한 모든 주장은 `evidence.yml`에 연결하고 한계도 명시한다. 현재성을 주장하려면 날짜가 있는 1차 출처, 조회일, 지역 또는 적용 범위, 재검토일, 갱신 담당자가 필요하다. 제3자·AI 생성·출연자 유래·사용자 생성 자료에는 출처, 제작자 또는 기여자, 출처 표기, 사용 목적, 권리 또는 동의, 개인정보, 승인자, 철회 상태를 기록한다.

## 적용할 안전 게이트 {#applicable-safety-gates}

출시 전 접근성, 실화폐 가격·확률 고지, 아동·취약 플레이어 보호, 개인정보·텔레메트리, AI 또는 UGC 권리·동의, 플랫폼 정책, 실험 가드레일, 재화 획득처·소비처 악용 위험, 중단 조건, 롤백에 적용할 게이트를 확인한다. 적용하지 않는 게이트에는 서면 근거와 사람 승인자가 필요하다.

## 결과물 구성 가이드 {#output-story-hints}

Markdown에는 전체 디자인과 결정 기록을 보존한다. PDF와 DOCX에는 안정적인 계층, 근거 위치, 표, 승인 상태를 유지한다. PPTX는 청중에 맞춰 작성하고, 맥락과 목표 경험, 디자인 결정과 대안, 근거·위험·완료 게이트 순으로 구성한다. Markdown을 제목 단위로 기계적으로 분리하지 않는다.

## 에셋 {#assets}

이 초안에는 승인된 다이어그램이 없다. 공간 구조가 이해를 실질적으로 높일 때만 다이어그램을 추가한다. 상대 경로의 로컬 에셋은 `assets/`에 저장하고, 비어 있지 않은 대체 텍스트를 제공하며, 출처·권리·동의·개인정보·승인·철회 정보를 `assets/README.md`에 기록한다.

## 결정 {#decisions}

지속해서 참조할 디자인·범위·안전·근거·출시 결정은 `decisions/`에 기록한다. 각 결정에는 대안, 근거 ID, 근거, 영향, 담당자, 승인 상태, 롤백, 재개 조건을 명시한다.

## 변경 이력 {#change-history}

| 버전 | 날짜 | 담당자 | 변경 내용 | 승인 |
| --- | --- | --- | --- | --- |
| 1 | 2026-08-04 | artifact-owner | 검토 가능한 프로덕션 디자인 초안과 완료 기준을 만들었다. | pending human review |
