# README 소개 근거 흐름 도식 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** README 소개의 자료·검토 설명을 한눈에 이해할 수 있는 Skillstead
근거 흐름도와 자연스러운 한국어 문구로 보완한다.

**Architecture:** 기존 README 도식 계약에 `evidence-to-design-flow` 한 쌍을
추가한다. SVG가 의미와 편집 가능한 원본을 소유하고, Skillstead 정식 렌더러가
2배 PNG를 만든다. README 본문과 SVG 문구는 `humanize-korean` 검수 뒤에만
게시하며, Archify 카탈로그는 최종 README 바이트에 다시 결합한다.

**Tech Stack:** Markdown, SVG, Skillstead svg-infographic 0.9.0, Node.js 18+,
Chromium, Node test runner

## Global Constraints

- 설계 기준은 `docs/superpowers/specs/2026-08-12-readme-introduction-evidence-diagram-design.md`다.
- 새 도식은 1400×900 SVG와 2800×1800 PNG 한 쌍이다.
- 기존 README 도식 8쌍과 그 의미·바이트를 바꾸지 않는다.
- 수치 49·6·16·7, 날짜 2026-08-11, 제품명, URL과 파일 경로는 보존한다.
- 도식과 소개 본문은 한국어 의미를 먼저 쓰며 자동 승인을 암시하지 않는다.
- `humanize-korean` 변경률 30% 초과는 경고, 50% 이상은 롤백한다.
- 사용자 소유 `docs/에이전트/`와 `package-lock.json`을 수정하거나 커밋하지 않는다.
- 새 dependency를 추가하지 않는다.

---

### Task 1: 도식 의미 계약을 RED로 고정

**Files:**
- Modify: `tests/contracts/root-readme-user-guides.test.mjs`
- Reference: `README.md`
- Reference: `guides/assets/readme/first-result-routing-flow.svg`

**Interfaces:**
- Consumes: `readmeSkillsteadDiagrams`, `readmeSkillsteadGraphContracts`
- Produces: `evidence-to-design-flow`의 정확한 노드·간선·문구·파일 수 계약

- [ ] **Step 1: 새 도식을 README 도식 목록에 추가**

`플러그인 소개` 섹션에 `evidence-to-design-flow`를 등록하고 다음 문구를
순서대로 요구한다.

```js
[
  "원문 49편", "최근 확인한 1차 자료 16건", "사실·추론·가정을 나눠 기록",
  "기획에 계속 쓸 원칙 7개", "제작 기획 (Studio)", "학습·취업 준비 (Career)",
  "기준 기획 결과물", "담당자를 정해 검토",
]
```

- [ ] **Step 2: 그래프 계약 추가**

노드 8개와 실선 8개, 점선 보류·수정 간선 1개를 정확한 순서로 고정한다.
점선 간선은 `human-review`에서 `evidence-boundary`로 돌아가야 한다.

- [ ] **Step 3: 파일 수와 한국어 경계 강화**

정확한 README 도식 파일 수를 8쌍에서 9쌍으로 바꾸고, 새 SVG가
`증거 후보`, `lane`, 영어 단독 `Artifact`, 자동 승인 문구를 포함하면
실패하도록 한다.

- [ ] **Step 4: focused RED 확인**

Run:

```bash
node --test tests/contracts/root-readme-user-guides.test.mjs
```

Expected: 새 SVG·PNG와 README embed가 없어서 도식 계약만 실패한다.

---

### Task 2: Skillstead 도식과 README 설명 제작

**Files:**
- Create: `guides/assets/readme/evidence-to-design-flow.svg`
- Create: `guides/assets/readme/evidence-to-design-flow.png`
- Modify: `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Task 1의 정확한 그래프·문구 계약
- Produces: 편집 가능한 SVG, 2배 PNG, README의 PNG→SVG 링크

- [ ] **Step 1: 1400×900 SVG 작성**

기존 README Skillstead 색상·타이포그래피를 재사용하고, 8개 노드와 9개
간선을 `data-flow-node`, `data-flow-edge`, `data-from`, `data-to`로 표시한다.
사람 검토 노드에는 다음 속성을 둔다.

```xml
data-human-gate="이름을 기록한 검토 담당자"
data-gate-role="approval-hold"
data-gate-label="승인·보류"
```

- [ ] **Step 2: Skillstead 원본 검사**

Run:

```bash
node shared/vendor/skillstead/svg-infographic/0.9.0/scripts/check-svg.mjs \
  guides/assets/readme/evidence-to-design-flow.svg
```

Expected: `0 error(s), 0 warning(s)`.

- [ ] **Step 3: 정식 2배 PNG 렌더**

Run:

```bash
node shared/vendor/skillstead/svg-infographic/0.9.0/scripts/render.mjs \
  guides/assets/readme/evidence-to-design-flow.svg
```

Expected: Chromium 실행 정보와 2800×1800 PNG 확인이 출력된다.

- [ ] **Step 4: README에 도식 삽입**

`어떤 자료를 참고했나요?`의 자료 표 다음에 도식 설명과 아래 링크를 넣는다.

```markdown
[![자료가 검토 가능한 기획 결과와 담당자 승인으로 이어지는 흐름](guides/assets/readme/evidence-to-design-flow.png)](guides/assets/readme/evidence-to-design-flow.svg)
```

- [ ] **Step 5: 픽셀 시각 검수**

PNG를 맞춤 보기와 원본 크기로 열어 한글 깨짐, 잘림, 겹침, 왜곡, 약한
화살표와 불명확한 점선 복귀 경로가 없는지 확인한다.

---

### Task 3: README와 도식 문구를 humanize-korean으로 윤문

**Files:**
- Modify when needed: `README.md`
- Modify when needed: `guides/assets/readme/evidence-to-design-flow.svg`
- Create locally: `_workspace/2026-08-12-NNN/final.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: 최종 후보 README 소개 본문과 SVG의 모든 보이는 문구
- Produces: 의미가 같은 윤문본, 변경률·등급·6항 자체검증 기록

- [ ] **Step 1: 로컬 결과 경로 제외**

`.gitignore`에 `_workspace/`를 추가해 윤문 작업 기록이 배포물에 섞이지 않게
한다.

- [ ] **Step 2: Fast Path 탐지와 윤문**

`humanize-korean/references/quick-rules.md`에 따라 D→A→I→G→H→F→B→C·J→E
순서로 검수한다. 규칙에 걸린 문구만 고치고 수치·날짜·고유명사·URL을
그대로 둔다.

- [ ] **Step 3: final.md와 HUMANIZE-SUMMARY 작성**

최종 소개 문구와 도식 문구, 원본·윤문본 글자수, 변경률, 범주별 탐지 건수,
자체검증 6항, 등급과 변경 사례를 한 개의 HTML 주석 블록에 기록한다.

- [ ] **Step 4: 윤문 후 재렌더**

SVG 문구가 바뀌었으면 원본 검사와 정식 PNG 렌더를 다시 실행하고 픽셀을
재검수한다.

---

### Task 4: 출처 결합과 전체 검증

**Files:**
- Modify: `guides/archify-diagrams/catalog.json`
- Verify: `README.md`
- Verify: `guides/assets/readme/evidence-to-design-flow.svg`
- Verify: `guides/assets/readme/evidence-to-design-flow.png`

**Interfaces:**
- Consumes: 최종 README와 도식 바이트
- Produces: 현재 출처 해시, 초록색 전체 문서·도식 검증 결과

- [ ] **Step 1: focused GREEN 확인**

Run:

```bash
node --test tests/contracts/root-readme-user-guides.test.mjs
```

Expected: 모든 README 계약 통과.

- [ ] **Step 2: Archify 출처 해시 갱신**

README의 `source_digest`만 현재 SHA-256으로 갱신한다. 선택된 명세, HTML,
영수증과 시각 QA 파일은 바꾸지 않는다.

- [ ] **Step 3: 문서·도식 검증**

Run:

```bash
npm run validate:guides
npm run validate:archify-catalog
node tooling/audit-game-design-docs.mjs
git diff --check
```

Expected: 가이드와 카탈로그 통과, 문서 감사 고심각도 0건, diff 오류 0건.

- [ ] **Step 4: 전체 회귀와 통합**

Run `npm test`. 모든 테스트가 통과하면 커밋하고 `main`에 fast-forward로
병합한다. 병합 결과에서 README·Archify focused 계약을 다시 실행한 뒤 작업
worktree와 기능 브랜치를 제거한다.
