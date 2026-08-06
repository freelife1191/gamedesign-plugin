# Task 6 — Studio Skillstead diagram pairs

## Status

Fix round 1 완료. Studio use-case 18쌍과 direct-skill 15쌍은 각 5단계 semantic contract와 결정 분기를 갖는 editable SVG 및 2× PNG로 재생성되었습니다.

## BASE / HEAD

- BASE: `b4f48e43633a1af22b9af9677d5baedaa1e54041`
- Round 0 implementation: `b48ac7a87f3a2967f9cb54c06193576d7448bf99`

## Fix round 1 findings addressed

- ST-C는 입력→전문 스킬→Canonical Artifact→검토→출력의 정확한 5 stage 및 source semantic의 installed specialist/output/review condition을 갖습니다.
- ST-G는 제약→선택지→판단 기준→결정→검증의 5 stage, 두 choice branch와 판단 기준으로의 재결합을 갖습니다.
- Skill flow는 trigger→필수 입력→skill-owned work→output→next route의 5 stage와 exact installed skill/output/next route를 갖습니다. ST-S09는 `canonical-artifact`와 canonical route skill IDs를 semantic metadata에 보존합니다.
- `--check`는 SVG뿐 아니라 deterministic renderer가 만든 PNG bytes도 비교하며, 완전하지만 다른 2800×1800 PNG regression을 거부합니다.
- 루트 보고서를 이 SDD task 경로로 이동했습니다.

## RED / GREEN

- RED: 5 stage가 없는 Studio source(`ST-C01: 4 !== 5`), branch renderer 부재, complete-but-different PNG가 check를 통과하던 문제를 unit/contract test로 재현했습니다.
- GREEN: source schema fail-closed validation, branch renderer, PNG byte equality 및 wrong-valid skill/output/next-route/branch mutation tests를 추가했습니다. unit 22개와 Studio contract 31개가 통과했습니다.

## 생성 수와 scope

- `game-design-studio-use-case`: 18쌍 (`st-c01`…`st-c08`, `st-g01`…`st-g10`)
- `game-design-studio-skill`: 15쌍 (`st-s01`…`st-s15`; 파일명은 exact installed skill ID)
- 기존 `game-design-studio` recipe scope 6개 manifest entry는 변경하지 않았습니다.

## Visual QA

ST-C03, ST-G01, ST-G06, 가장 긴 skill flow ST-S09를 high/original detail로 재검사했습니다. ST-C03/ST-S09의 5개 stage, ST-G01/ST-G06의 두 branch와 `재결합: 판단 기준`이 물리적으로 판독되며 CJK/Latin glyph, card containment, connector endpoint, 하단 boundary에 clipping·overlap·tofu가 없습니다. 분기형 4·5단계 카드에서 발견한 stage tag/title 겹침은 160px 카드와 분리한 baseline으로 보정 후 재생성했습니다. 상세 결과는 `guides/assets/VISUAL-QA.md`에 기록했습니다.

## Concerns / open

- 없음. 최종 handoff 전 `npm run check:guide-diagrams`, 관련 unit/contract test, 변경 JavaScript의 `node --check`, `git diff --check`를 다시 통과했습니다.
