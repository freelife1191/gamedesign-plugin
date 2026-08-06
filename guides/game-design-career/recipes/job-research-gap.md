# 현재 공고 근거로 역할 gap 조사하기

> 본문에 쓰인 고정 한국 이름은 모두 **가상 예시 담당자**입니다. 실제 실행에서는 host user-decision receipt에 기록된 named human을 사용합니다.

![공식 공고와 표본 경계가 역량 gap, minimum repair, 사람 검토를 거쳐 current evidence artifact로 이어지는 흐름.](../../assets/game-design-career/job-research-evidence-flow.png)

## 완료 목표

공식 공고 표본의 required·preferred를 날짜와 범위가 있는 evidence record로 남기고, 일반화하지 않은 gap과 다음 증거 작업을 정리합니다. 채용 결과를 보장하지 않습니다.

## 준비할 입력

- 역할, seniority, 지역, 조사일, official HTTPS source 후보와 공개 가능한 portfolio evidence
- Canonical Artifact family: `game-design-career/<career-id>/job-posting-evidence/`, `game-design-career/<career-id>/competency-matrix/`, `game-design-career/<career-id>/portfolio-project-brief/`
- 템플릿: `job-posting-evidence`, `competency-matrix`, `portfolio-project-brief`

## 복사 가능한 요청문

Codex App 자연어 요청:

```text
@Game Design Career 개인정보·실명·회사기밀 raw input은 입력하지 말고 익명화된 공개 evidence ID와 한국의 공개 공식 공고만 사용해. 관찰 사실·추론·제안, 출처와 표본 한계를 분리해 역할 gap과 portfolio project brief를 만들어.
```

Codex CLI 명시 호출:

```text
$game-design-career:research-game-design-jobs game-design-career/<career-id>/job-posting-evidence/를 만들고 $game-design-career:map-game-design-career, $game-design-career:build-game-design-portfolio로 competency-matrix와 portfolio-project-brief를 연결해.
```

## 단계별 진행

1. 공고별 `관찰 사실`은 `sourceUrl`, `location`, `retrievalDate`, `region`, `sample boundary`, `reviewAfter`와 source ID를 가진 record로만 기록합니다.
2. 반복 신호는 제한된 표본의 `추론`으로 표시하고, 개인 evidence 부족은 `제안`인 portfolio-project-brief proof task로 전환합니다.
3. stale evidence는 재검색 전에는 current claim에 사용하지 않습니다. 같은 source location을 재검색해 새 ID로 연결합니다.
4. 이미지 계획은 `prompt-only`는 prompt와 placeholder만 처리합니다. `select`는 사람이 제출한 receipt의 stable ID만 처리합니다. `required`는 finite required asset만 처리하고, `all`은 declared asset만 처리합니다.

## 사람이 결정할 지점

Research Owner **이민아**가 조사 지역·표본 경계를, Portfolio Reviewer **최유진**이 공개 가능한 evidence와 backlog 우선순위를 승인합니다.

## 예상 결과

`job-posting-evidence/content.md`, `competency-matrix/content.md`, `portfolio-project-brief/content.md`에 출처별 requirement, sample limit, gap과 proof task가 남습니다.

## 실패와 재개

Chromium renderer 또는 필요한 capability가 unavailable이면 PNG unavailable 상태로 남기고 Canonical Artifact와 기존 output을 보존합니다. stale record는 재검색 후 새 source ID를 추가하고 삭제하지 않은 기존 기록에서 재개합니다.

## 관련 기능

- [공고 조사](../skills/research-game-design-jobs.md), [역할 매핑](../skills/map-game-design-career.md), [portfolio 구축](../skills/build-game-design-portfolio.md), [템플릿](../templates.md)
- [공통 Artifact 수명주기](../../assets/shared/canonical-artifact-lifecycle.png)
