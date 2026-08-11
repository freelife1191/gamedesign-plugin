# 게임 기획 문서 언어 감사

## 범위

2026-08-11에 `shared/templates`, `shared/knowledge/trends`, 프롬프트 카탈로그 원본, Studio와 Career의 사용자 결과 템플릿을 검사했습니다. 제품별 30개 `content.md`의 보이는 표제·설명·표 작업 지시와 각 템플릿의 90개 content/evidence/export 계약 파일을 함께 확인했습니다. 원천을 고친 뒤 `plugins/` 설치 스냅샷은 표준 빌드로 다시 만들었습니다. vendor, README, 샘플 결과, 이미지·도식 자료는 이 감사기의 검사 대상이 아니며 각각 전용 계약으로 검증합니다.

## 결과

- 검사 파일: 172개
- 고심각도 이슈: 0개
- 수정한 항목: 30개 결과 템플릿의 표제·본문 설명·표 작업 지시를 실제 한국어로 바꿨습니다. 영어 표제 앞에 `기획 항목:`만 붙이던 임시 표기는 모두 제거했습니다
- 보존한 항목: stable ID, YAML·JSON 키, 경로, 링크, 날짜, 수치, 출처와 인용, 승인 상태
- 근거 확인일: source register의 최상위와 모든 source `retrievedAt`을 `2026-08-11`로 일치시켰고, 날짜가 하나라도 달라지면 감사 계약이 실패합니다
- 현재 관행 근거: Steam Early Access의 공식 플랫폼 안내와 저장소 내부 플레이테스트 절차 종합을 별도 claim으로 분리했습니다. 후자는 외부 정책이 아니며 기록·검토 절차의 문맥으로만 사용합니다

## 프롬프트 결과 안내

152개 카드 모두에 한국어 display title과 source ID·첫 결과 파일 경로를 함께 지닌 가상 결과 조각을 넣었습니다. 결과 조각은 특정 프로젝트의 사실이 아니라 검토 전 예시임을 밝히며, 대상 플레이어·기획 원칙·튜토리얼 건너뛰기·다시 보기처럼 한국어 의미를 먼저 씁니다. 영어 명사에 한국어 조사를 붙이거나 같은 `예: 경로에 ...` 골격을 반복하면 카탈로그 검증이 실패합니다. 모든 스킬 카드의 첫 화면에는 `간단 요청 예시`, `짧은 흐름`, `이 요청으로 받는 결과`를 한국어 우선으로 보이고, 명령어·안전 경계·재개 기록은 접을 수 있는 고급 정보로 분리했습니다.

## 검증

```bash
node tooling/audit-game-design-docs.mjs
node tooling/audit-evidence.mjs --check
node --test tests/unit/audit-game-design-docs.test.mjs tests/unit/prompt-template-catalog.test.mjs tests/contracts/prompt-template-guides.test.mjs tests/contracts/evidence-audit.test.mjs
npm run build:prompt-guides
npm run check:prompt-guides
npm run validate:guides
```

결과: 문서 감사는 172개 파일에서 고심각도 이슈 0개를 보고했고, 근거 감사·단위/계약 테스트·프롬프트 가이드 생성·검사가 통과했습니다. 이 검증은 문체·구조·경계 보존을 다루며 사실의 실질적 정확성이나 사람의 승인 결정을 대신하지 않습니다.

## 감사 기준

감사기는 번역투의 자동 생성 문장, 근거 없는 과장, 설명 없는 영어 우선 표제, 반복 결론을 고심각도로 표시합니다. 한국어 접두어 뒤에 영어 표제를 그대로 두거나, 한글 몇 글자 뒤에 영어 본문을 붙여 검사를 피하는 문장도 차단합니다. UX, UI, LiveOps, API, prompt, token과 stable ID·명령어·파일 경로는 게임 제작 문맥의 표준 용어 또는 보호 대상이므로 표시하지 않습니다.

## 남겨 둔 문서

사실·추론·제안, 불확실성, 승인 경계, 법률·플랫폼·시장 주장, 출처는 문체를 이유로 바꾸지 않았습니다. 현재형 외부 주장은 각 claim의 확인일·범위·한계를 확인한 뒤에만 갱신합니다. 이 감사는 사실 확인, 권리 판단, 플랫폼 승인, 출시 또는 채용 결과를 보장하지 않습니다.
