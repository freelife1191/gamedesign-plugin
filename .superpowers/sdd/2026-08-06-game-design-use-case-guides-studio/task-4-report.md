# Task 4 실행 보고서

## Status

완료 — 직접 호출 계약, 15개 스킬 가이드, 워크벤치 라우터와 집중 계약 검증을 마쳤습니다.

## BASE / HEAD

- BASE: `26a44cbf92ebaadf7d52f3086cf7428c407c1995`
- 구현 HEAD: `85f043febe627e99fab25da8ba17f45dac95d320`

## 변경 파일

- `guides/game-design-studio/use-cases/skill-workbench.md` (신규)
- `guides/game-design-studio/use-cases/README.md`
- `guides/game-design-studio/skills/` 아래 15개 직접 호출 가이드
- `tests/contracts/user-guides-studio.test.mjs`
- `tests/contracts/user-guide-use-case-manifest.test.mjs`

## RED 증거

2026-08-06에 다음 명령을 실행했습니다.

```text
node --test tests/contracts/user-guides-studio.test.mjs
node --test tests/contracts/user-guide-use-case-manifest.test.mjs
```

- Studio guide 계약: `apply-document-quality-profile: missing direct-use H3`로 1개 실패. 새 계약이 아직 없는 직접 호출 H3를 정확히 탐지했습니다.
- Manifest 계약: `ST-S01: direct-use heading exists`로 1개 실패. 매니페스트 anchor가 아직 실제 H3에 연결되지 않았음을 확인했습니다.

## GREEN 증거

- `node --test tests/contracts/user-guides-studio.test.mjs` → 12 passed / 0 failed.
- `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` → 22 passed / 0 failed.
- `git diff --check` → 출력 없음, exit 0.
- 각 가이드는 고정 H2 14개를 유지하면서 H3 `직접 호출 활용 — <skill>`에 직접 조건, 입문·응용·고급 요청문, Artifact 읽기 순서와 조건부 다음 handoff를 제공합니다.
- 워크벤치는 15개 설치 스킬을 오케스트레이션·도메인 설계·품질·검토·이미지·시각화·출력 lane으로 각각 한 번씩 연결합니다.

## 테스트 결과

- RED 실행: `user-guides-studio` 10 passed / 1 failed, `user-guide-use-case-manifest` 21 passed / 1 failed.
- GREEN 실행: `user-guides-studio` 12 passed / 0 failed, `user-guide-use-case-manifest` 22 passed / 0 failed.

## 우려사항

- 직접 호출 예시는 문서 계약이며 runtime 동작이나 이미지 provider 설정을 변경하지 않습니다.
- 이미지 mode(`prompt-only`/`select`/`required`/`all`), named human approval, Skillstead wrapper 및 renderer fallback 경계는 유지했습니다.
