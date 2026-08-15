# Fix6 진행 기록

- RED: 새 프로토콜 회귀 7건을 먼저 추가했다. 기존 구현에서 retired 재개, 무관 prefix 무시, claim staging 정리, nlink=2 release, EIO 후 retry, fresh-publisher 장벽이 실패했다. 정렬 claim 검사는 기존 상태 결과가 우연히 같아 정확 marker 불변식 assertion을 추가해 비공허하게 만들었다.
- GREEN: 정상 잠금 owner anchor와 `recovery.v1` claim/abort/retired 상태기를 구현했다.
- 검증: `node --test tests/unit/game-design-update-check.test.mjs` 41/41, `npm run test:unit`, `npm run build`, `npm run build -- --check`, `git diff --check`, 세 script `node --check`를 실행했다.
