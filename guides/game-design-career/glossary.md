# 포트폴리오 용어를 사람 검토로 관리하기

이 가이드는 Career 문서와 포트폴리오에서 쓰는 게임 기획 용어를 후보로 모으고, 사람이 승인한 용어만 스냅샷으로 기록하는 방법을 설명합니다. 용어 사전은 원문을 자동 치환하지 않으며, 개인 기여나 경험을 새로 만들지 않습니다.

## 용어 후보를 요청하기

```text
@Game Design Career 포트폴리오 분석 문서에서 용어 후보를 찾아 줘. TERM-PLAYER-POWER의 한국어 선호 표현은 플레이어 파워, 영어 선호 표현은 Player Power로 제안하고, 원문은 자동 치환하지 마.
```

```text
$game-design-career:maintain-game-design-glossary 후보 용어의 정의, 포트폴리오 적용 범위, 근거 ID, 금지 표현과 혼동할 개념을 제안해 줘. 사람 승인 전에는 proposed 상태로만 남겨 줘.
```

## 후보부터 영향 검토까지 진행하기

용어는 다음 순서로 관리합니다:

1. **candidate**: 문서와 근거 ID에서 후보를 추출합니다
2. **proposed**: 정의, 범위, 한국어·영어 선호 표현을 제안합니다
3. **conflict check**: 기존 승인 용어, 동의어, 약어와 충돌을 확인합니다
4. **human approval**: 이름이 확인된 사람이 승인·거부·대체·폐기 결정을 내립니다
5. **snapshot**: 승인된 용어 ID와 문서 ID에 묶인 스냅샷을 만듭니다
6. **document validation**: 문서를 검사하고 찾은 문제만 보고합니다
7. **deprecation**: 대체 용어와 이유를 확인한 뒤 이전 용어를 폐기합니다
8. **impact review**: 폐기·대체가 영향을 주는 포트폴리오 문서와 표현을 사람이 검토합니다

`TERM-PLAYER-POWER`는 `플레이어 파워`와 `Player Power`를 함께 검토할 수 있는 예시입니다. 두 표현이 함께 나와도 승인이나 의미 변경을 추론하지 않습니다.

공통 용어 사전과 프로젝트 오버레이는 `TERM-*` ID로 병합합니다. 같은 ID가 충돌하면 명시적 이유와 이름이 확인된 사람의 승인이 있어야 합니다.

값만 담은 진단은 비공개 원문, 비밀, 절대 경로를 싣지 않습니다. 문제 코드와 필요한 용어 ID만 보고합니다.

## 남는 파일과 사람 결정

승인된 용어와 검사 결과는 결과 폴더의 다음 경로에 기록합니다:

- `reference-intelligence/glossary/terms.json`: 승인된 용어와 상태
- `reference-intelligence/glossary/glossary-receipt.json`: 문서·용어 선택·사람 결정에 묶인 스냅샷 영수증
- `reference-intelligence/glossary/glossary.ko.md`: 한국어 조회용 목록
- `reference-intelligence/glossary/glossary.en.md`: 영어 조회용 목록
- `reference-intelligence/glossary/terminology-findings.md`: 문서 검사에서 찾은 항목
- `reference-intelligence/decisions/glossary-<safe-event-id>.json`: 사람 결정과 이유

검사는 수정문을 반환하지 않습니다. 사람은 findings와 impact review를 보고 원문을 고칠지, 유지할지, 새 후보로 남길지 결정합니다.

## 레퍼런스 분석으로 돌아가기

용어 후보의 관찰 근거와 시스템 맥락은 [포트폴리오 레퍼런스 분석](reference-analysis.md)에서 확인합니다. 분석 결과가 `hold`이거나 근거가 부족하면 용어도 자동 승인하지 않고 확인 질문을 남깁니다.
