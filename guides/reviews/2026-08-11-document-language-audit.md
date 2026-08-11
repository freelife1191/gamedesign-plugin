# 게임 기획 문서 언어 감사

## 범위

2026-08-11에 `shared/templates`, `shared/knowledge/trends`, 프롬프트 카탈로그 원본, Studio와 Career의 사용자 결과 템플릿을 검사했습니다. `plugins/` 생성물, vendor, README, 샘플 결과, 이미지·도식 자료는 검사와 수정에서 제외했습니다.

## 결과

- 검사 파일: 172개
- 고심각도 이슈: 0개
- 수정한 항목: 영어 우선 공용 표제 `Asset register`, `Decision records`와 공유 템플릿의 사용자 표제를 한국어 우선으로 바꿨습니다
- 보존한 항목: stable ID, YAML·JSON 키, 경로, 링크, 날짜, 수치, 출처와 인용, 승인 상태

## 프롬프트 결과 안내

모든 스킬 카드의 첫 화면에는 `간단 요청 예시`, `짧은 흐름`, `이 요청으로 받는 결과`를 한국어 우선으로 보이고, 명령어·안전 경계·재개 기록은 접을 수 있는 고급 정보로 분리했습니다. Studio와 Career에는 각각 `polish-game-design-writing`의 beginner·standard·advanced 카드와 스킬 안내를 추가했습니다. 카드가 가리키는 직접 명령, 설치된 스킬, 역할, 템플릿은 생성 전 카탈로그·제품 inventory와 대조했습니다.

## 검증

```bash
node tooling/audit-game-design-docs.mjs
node --test tests/unit/audit-game-design-docs.test.mjs tests/unit/prompt-guides.test.mjs
npm run build:prompt-guides
npm run check:prompt-guides
npm run validate:guides
```

결과: 문서 감사는 172개 파일에서 고심각도 이슈 0개를 보고했고, 단위 테스트와 프롬프트 가이드 생성·검사·전체 가이드 검증이 통과했습니다. 이 검증은 문체·구조·경계 보존을 다루며 사실의 실질적 정확성이나 사람의 승인 결정을 대신하지 않습니다.

## 감사 기준

감사기는 번역투의 자동 생성 문장, 근거 없는 과장, 설명 없는 영어 우선 표제, 반복 결론을 고심각도로 표시합니다. UX, UI, LiveOps, API, prompt, token과 stable ID·명령어·파일 경로는 게임 제작 문맥의 표준 용어 또는 보호 대상이므로 표시하지 않습니다.

## 남겨 둔 문서

사실·추론·제안, 불확실성, 승인 경계, 법률·플랫폼·시장 주장, 출처는 문체를 이유로 바꾸지 않았습니다. 현재형 외부 주장은 각 claim의 확인일·범위·한계를 확인한 뒤에만 갱신합니다. 이 감사는 사실 확인, 권리 판단, 플랫폼 승인, 출시 또는 채용 결과를 보장하지 않습니다.
