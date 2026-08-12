# README Plugin Introduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 루트 README에 개발 취지, 추천 사용자, 활용 질문과 근거 자료를 설명하는 한국어 플러그인 소개 섹션을 추가한다.

**Architecture:** `README.md`는 입문자가 읽는 설명을 소유하고, 수량과 최신성의 기준은 `shared/knowledge/reference-index.json`, `shared/knowledge/core/`, `shared/knowledge/trends/source-register.json`에 둔다. README 계약 테스트가 섹션 순서, 목차, 수량, 출처 링크와 한계 문구를 기준 자료와 교차 검증한다.

**Tech Stack:** Markdown, Node.js 18+, Node test runner, JSON, repository guide and Archify catalog validators

## Global Constraints

- 설계 기준은 `docs/superpowers/specs/2026-08-12-readme-plugin-introduction-design.md`다.
- 새 H2 `플러그인 소개`는 `목차`와 `30초 안에 플러그인 선택하기` 사이에 둔다.
- 원문 수량과 범주는 `shared/knowledge/reference-index.json`에서 계산한다.
- 현재 외부 근거 수량과 확인일은 `shared/knowledge/trends/source-register.json`에서 계산한다.
- 유리링 관련 자료를 공식 자막, 채널 운영자 검수본 또는 보편 법칙이라고 표현하지 않는다.
- 한국어 설명이 영문 ID와 기술 용어보다 먼저 온다.
- 스킬 ID를 몰라도 쓸 수 있는 짧은 자연어 질문을 제공한다.
- 새 dependency를 추가하지 않는다.
- 미추적 `docs/에이전트/`와 `package-lock.json`은 수정하거나 커밋하지 않는다.
- Markdown 구분 개선 범위는 루트 README와 `guides/README.md`, Studio·Career
  제품 README로 한정한다.
- 네 문서의 모든 H2 앞에 `---`를 두고, 기존 H2 문구와 앵커는 바꾸지 않는다.

---

### Task 1: Lock the introduction contract

**Files:**
- Modify: `tests/contracts/root-readme-user-guides.test.mjs`
- Reference: `shared/knowledge/reference-index.json`
- Reference: `shared/knowledge/trends/source-register.json`
- Reference: `shared/knowledge/core/*.md`

**Interfaces:**
- Consumes: `requiredRootHeadings`, `exactSection()`, `visibleMarkdownLinks()`
- Produces: `assertPluginIntroduction(markdown, evidence)` contract used by the production README test

- [ ] **Step 1: Add `플러그인 소개` to the exact H2 contract**

Insert the heading immediately after `목차` in `requiredRootHeadings`.

- [ ] **Step 2: Add evidence-derived introduction assertions**

Read the reference index and current source register. Require these exact values in the introduction: total 49, Yuriring 6, category counts 13/10/13/10/3, seven Core Markdown files, current sources 16 and `retrievedAt` `2026-08-11`.

- [ ] **Step 3: Require user, capability, question and limitation blocks**

Require the visible headings `어떤 플러그인인가요?`, `왜 만들었나요?`, `이런 분께 잘 맞습니다`, `이 플러그인으로 할 수 있는 일`, `처음에는 이렇게 물어보세요`, `어떤 자료를 참고했나요?`, `자료를 답으로 바꾸는 방식`, `레퍼런스와 더 읽을 문서`. Require Studio, Career, 사람 검토, 최신 공식 자료 재확인 and no guarantee language.

- [ ] **Step 4: Add hostile mutations**

Remove the Yuriring link, change total sources to 50, claim the reports are official transcripts, remove the Current review boundary and replace a natural-language question with a skill-ID-only example. Require each mutation to fail for its intended reason.

- [ ] **Step 5: Run the focused test and confirm RED**

Run `node --test tests/contracts/root-readme-user-guides.test.mjs`. Expect failure because the production README lacks `플러그인 소개`.

### Task 2: Write and humanize the introduction

**Files:**
- Modify: `README.md`
- Test: `tests/contracts/root-readme-user-guides.test.mjs`

**Interfaces:**
- Consumes: Task 1 introduction contract and canonical evidence files
- Produces: the beginner-facing `플러그인 소개` section and matching TOC entry

- [ ] **Step 1: Update the TOC and H2 order**

Add `플러그인 소개` as item 1 and renumber the existing items 2 through 13.

- [ ] **Step 2: Add the approved eight-part introduction**

Write the eight H3 blocks from the design. Use short prose, one audience table, one evidence table and short natural-language prompt examples.

- [ ] **Step 3: Apply Korean writing review**

Check the new section against `humanize-korean` quick rules. Preserve Game Design Studio, Game Design Career, YouTube, all dates, counts, links and identifiers. Remove translation-like phrasing, repeated connective adverbs and unexplained English-first terms without changing meaning.

- [ ] **Step 4: Run the focused contract**

Run `node --test tests/contracts/root-readme-user-guides.test.mjs`. Expect every test to pass.

### Task 3: Rebind source evidence and verify the documentation surface

**Files:**
- Modify when required by validator: `guides/archify-diagrams/catalog.json`
- Verify: `README.md`
- Verify: `tests/contracts/root-readme-user-guides.test.mjs`

**Interfaces:**
- Consumes: final README bytes
- Produces: current Archify catalog source digest and complete validation evidence

- [ ] **Step 1: Run catalog validation**

Run `npm run validate:archify-catalog`. If it reports only stale README source digests, update those records through the repository catalog rebaseline path without changing selected specs or published HTML.

- [ ] **Step 2: Run guide and writing checks**

Run `npm run validate:guides` and `node tooling/audit-game-design-docs.mjs`. Expect valid links and zero high-severity Korean documentation defects.

- [ ] **Step 3: Run final checks**

Run `node --test tests/contracts/root-readme-user-guides.test.mjs`, `npm run validate:archify-catalog`, `git diff --check` and `git status --short`. Expect all validations to pass and only the pre-existing untracked paths outside this task to remain.

### Task 4: Improve visual section boundaries

**Files:**
- Modify: `README.md`
- Modify: `guides/README.md`
- Modify: `guides/game-design-studio/README.md`
- Modify: `guides/game-design-career/README.md`
- Test: `tests/contracts/root-readme-user-guides.test.mjs`

- [ ] **Step 1: Add section dividers without changing anchors**

Put `---` immediately before every H2 in the four documents. Keep all existing H2 text.

- [ ] **Step 2: Add restrained document cues**

Use `🧭` for the root and global guide, `🎮` for Studio and `🎓` for Career in one
short opening callout per document.

- [ ] **Step 3: Lock and verify the formatting contract**

Require every visible H2 to have a preceding divider and every hub to contain its expected
emoji. Run the focused README contract and guide validator.
