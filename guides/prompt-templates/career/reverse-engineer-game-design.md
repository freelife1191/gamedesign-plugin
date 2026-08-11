# Game Design Career 프롬프트

모르는 정보는 `미정`으로 남기고, 자동 결과를 사람의 승인으로 바꾸지 마세요.

<!-- PROMPT-CARD: career:reverse-engineer-game-design:beginner -->
## career:reverse-engineer-game-design:beginner

**관찰과 해석을 나누어 쓰는 게임 역기획**

공개 build의 observation과 inference를 분리해 UI, rule, economy 가설을 안전하게 기록한다.

### 간단 요청 예시
```text
@Game Design Career 공개 build의 crafting UI와 rule, economy 변화 한 개를 observation과 inference로 나누고 unknown은 미정으로 남겨 줘. 공개 자료의 rights를 기록해 줘.
```

### 짧은 흐름
- 작업 순서: reverse-engineer-game-design
- 함께 검토하는 역할: reverse-design-critic → evidence-auditor

### 이 요청으로 받는 결과
관찰: 보스 체력이 절반 아래로 내려가면 회피 구간이 두 번 반복됩니다. 해석: 전투 속도를 늦추려는 규칙일 수 있으나 내부 설계 의도는 알 수 없어 검토 전 가설로 남겼습니다. (ID: career:reverse-engineer-game-design:beginner; 파일: game-design-career/career-foundations/reverse-beginner/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
공개 build에서 보이는 UI, rule, economy 변화를 observation으로 기록할 때 사용한다.

### 사용하지 않는 경우
내부 구현·의도·비공개 자료를 사실로 단정하거나 rights를 무시할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- public build/version
- platform
- observation source
- time window
- UI/rule/economy surface

#### 선택 입력
- screenshot rights note
- comparison build

### 바꿀 자리표시자
- [public build]
- [platform]
- [observation source]
- [surface]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [public build]의 [platform] [surface]를 [observation source]로 관찰해 observation과 inference를 나누고 rights를 기록해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:reverse-engineer-game-design build=public-1.4 platform=PC source=notes/crafting surface=ui,rules,economy observation과 inference를 분리해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:reverse-engineer-game-design build=[public build] platform=[platform] source=[observation source] surface=[surface] observation과 inference를 분리해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: reverse-engineer-game-design
- 스킬 흐름: reverse-engineer-game-design
- 전문 역할: reverse-design-critic → evidence-auditor

### 중간 산출물
- reverse-design-document

### 예상 결과물
#### 최소 결과물
- observation
- UI/rule/economy hypothesis
- inference
- rights note
- fact/inference/recommendation label

#### 선택 결과물
- confidence

#### 확장 결과물
- validation queue

### 파일 구조
- game-design-career/career-foundations/reverse-beginner/content.md
- game-design-career/career-foundations/reverse-beginner/evidence.yml
- game-design-career/career-foundations/reverse-beginner/export-manifest.yml

### 읽는 순서
- game-design-career/career-foundations/reverse-beginner/content.md
- game-design-career/career-foundations/reverse-beginner/evidence.yml
- game-design-career/career-foundations/reverse-beginner/export-manifest.yml

### 도식 바인딩
- ID: ca-s11
- SVG: guides/assets/game-design-career/skills/reverse-engineer-game-design.svg
- PNG: guides/assets/game-design-career/skills/reverse-engineer-game-design.png
- 대체 텍스트: 게임 역기획 직접 호출 흐름

### 사람 검토
#### 승인 경계
reverse-design-critic owner와 evidence-auditor가 observation, inference와 rights를 검토하고 승인 또는 보류한다. 가설은 내부 사실이나 채용 적합성을 보장하지 않는다.

#### 보류 조건
- 관찰 source가 없음
- rights가 미정인 screenshot을 사용함

#### 안전 경계
모르는 정보는 미정으로 남긴다. 현재 job/company/고용주/공고 facts를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 요구한다. Fact, inference, recommendation을 분리하며 경험·기여·채용 확률·적합성·합격을 발명하거나 보장하지 않는다. Reverse engineering은 observation, rule, UI, economy hypothesis, counterexample, rights와 alternative를 포함한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
reverse-beginner observation과 rights note를 보존하고 공개 source를 확인해 inference 분리부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:reverse-engineer-game-design:standard -->
## career:reverse-engineer-game-design:standard

**규칙·화면·경제 가설을 검증하는 게임 역기획**

rule, UI, economy 가설에 observation, inference, alternative와 validation method를 연결한다.

### 간단 요청 예시
```text
@Game Design Career 공개 build의 crafting rule, UI와 economy 가설을 observation, inference, counterexample, alternative, validation method와 rights note로 기록해 줘.
```

### 짧은 흐름
- 작업 순서: reverse-engineer-game-design
- 함께 검토하는 역할: reverse-design-critic → evidence-auditor

### 이 요청으로 받는 결과
상점 새로고침 비용이 구매를 늦춘다는 가설을 세웠지만, 희귀 상품을 기다리는 행동이라는 반례도 적었습니다. 두 설명 모두 검토 전이며 다음 플레이에서 보유 재화와 새로고침 횟수를 함께 기록합니다. (ID: career:reverse-engineer-game-design:standard; 파일: game-design-career/career-foundations/reverse-standard/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
관찰된 player action을 rule, UI, economy의 가설과 validation task로 추적할 때 사용한다.

### 사용하지 않는 경우
관찰 없이 구현 의도를 단정하거나 반례·rights·alternative가 없는 주장에는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- public build/version
- observation addresses
- rule/UI/economy hypothesis
- counterexample
- alternative
- validation method

#### 선택 입력
- rights evidence
- comparison build

### 바꿀 자리표시자
- [public build]
- [observation addresses]
- [hypothesis]
- [counterexample]
- [alternative]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [public build]의 rule/UI/economy [hypothesis]를 [observation addresses]로 기록하고 observation, fact, inference, recommendation, [counterexample], [alternative], validation method와 rights를 분리해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:reverse-engineer-game-design build=public-1.4 source=notes/crafting hypothesis=crafting-cost-rule counterexample=free-craft alternative=event-discount rule,UI,economy 가설을 검증해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:reverse-engineer-game-design build=[public build] source=[observation addresses] hypothesis=[hypothesis] counterexample=[counterexample] alternative=[alternative] rule/UI/economy observation, fact, inference, recommendation과 validation method를 검증해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: reverse-engineer-game-design
- 스킬 흐름: reverse-engineer-game-design
- 전문 역할: reverse-design-critic → evidence-auditor

### 중간 산출물
- reverse-design-document
- game-analysis-report

### 예상 결과물
#### 최소 결과물
- rule/UI/economy hypothesis — observation/fact/inference/recommendation label
- observation/fact/inference/recommendation split
- counterexample — observation/fact/inference/recommendation label
- alternative — observation/fact/inference/recommendation label
- rights — observation/fact/inference/recommendation label
- validation method — observation/fact/inference/recommendation label

#### 선택 결과물
- confidence state

#### 확장 결과물
- comparison observation

### 파일 구조
- game-design-career/career-foundations/reverse-standard/content.md
- game-design-career/career-foundations/reverse-standard/evidence.yml
- game-design-career/career-foundations/reverse-standard/export-manifest.yml

### 읽는 순서
- game-design-career/career-foundations/reverse-standard/content.md
- game-design-career/career-foundations/reverse-standard/evidence.yml
- game-design-career/career-foundations/reverse-standard/export-manifest.yml

### 도식 바인딩
- ID: ca-s11
- SVG: guides/assets/game-design-career/skills/reverse-engineer-game-design.svg
- PNG: guides/assets/game-design-career/skills/reverse-engineer-game-design.png
- 대체 텍스트: 게임 역기획 직접 호출 흐름

### 사람 검토
#### 승인 경계
reverse-design-critic owner가 rule/UI/economy 가설과 counterexample을 검토하고 evidence-auditor와 rights를 승인 또는 보류한다. 관찰은 내부 설계나 합격을 보장하지 않는다.

#### 보류 조건
- counterexample 또는 alternative가 없음
- validation method가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. 현재 job/company/고용주/공고 facts를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 요구한다. Fact, inference, recommendation을 분리하며 경험·기여·채용 확률·적합성·합격을 발명하거나 보장하지 않는다. Reverse engineering은 observation, rule, UI, economy hypothesis, counterexample, rights와 alternative를 포함한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
reverse-standard claim record와 counterexample을 보존하고 새 관찰을 연결해 alternative 검토부터 재개해.
```

</details>
<!-- PROMPT-CARD: career:reverse-engineer-game-design:advanced -->
## career:reverse-engineer-game-design:advanced

**반증 조건과 인용 권리를 갖춘 게임 역기획**

반증 가능한 reverse engineering claim에 rights, alternative, validation queue를 연결해 observation과 inference를 엄격히 분리한다.

### 간단 요청 예시
```text
@Game Design Career 공개 build 관찰로 만든 rule, UI, economy claim을 반증 가능성, counterexample, alternative, validation method, rights와 unresolved uncertainty로 audit해 줘.
```

### 짧은 흐름
- 작업 순서: reverse-engineer-game-design
- 함께 검토하는 역할: reverse-design-critic → evidence-auditor

### 이 요청으로 받는 결과
‘짧은 부활 대기 시간이 재도전을 늘린다’는 가설은 대기 시간이 같아도 이탈이 늘면 기각합니다. 공개 문서에는 직접 촬영한 화면만 후보로 두고 사용 권리는 별도 검토로 넘겼습니다. (ID: career:reverse-engineer-game-design:advanced; 파일: game-design-career/career-foundations/reverse-advanced/content.md)

<details>
<summary>고급 정보: 명령어·안전 경계·재개 기록</summary>

### 사용하는 경우
여러 공개 관찰에서 독립적으로 반증 가능한 rule, UI, economy claim을 정리할 때 사용한다.

### 사용하지 않는 경우
비공개 회사 자료·개인정보를 요구하거나 rights 검토 없이 외부 자료를 포트폴리오에 쓰려 할 때는 사용하지 않는다.

### 준비 입력
#### 필수 입력
- public observation addresses
- claim scope
- counterexample
- alternative
- validation method
- rights evidence

#### 선택 입력
- comparison builds
- unresolved uncertainty

### 바꿀 자리표시자
- [claim scope]
- [observation addresses]
- [counterexample]
- [alternative]
- [rights evidence]

### Codex App 완성 예시
위의 간단 요청 예시를 그대로 사용합니다.

### Codex App 재사용 템플릿
```text
@Game Design Career [claim scope]의 falsifiable claim을 [observation addresses], [counterexample], [alternative], [rights evidence]와 validation method로 audit하고 observation, fact, inference, recommendation을 분리해 줘.
```

### Codex CLI 완성 예시
```text
$game-design-career:reverse-engineer-game-design scope=crafting-economy source=notes/public-build counterexample=free-event alternative=temporary-discount rights=public-screenshot claim을 반증 가능하게 audit해.
```

### Codex CLI 재사용 템플릿
```text
$game-design-career:reverse-engineer-game-design scope=[claim scope] source=[observation addresses] counterexample=[counterexample] alternative=[alternative] rights=[rights evidence] falsifiability와 observation, fact, inference, recommendation을 audit해.
```

### 스킬·전문 역할 흐름
- 기본 스킬: reverse-engineer-game-design
- 스킬 흐름: reverse-engineer-game-design
- 전문 역할: reverse-design-critic → evidence-auditor

### 중간 산출물
- reverse-design-document
- game-analysis-report

### 예상 결과물
#### 최소 결과물
- falsifiable observation/fact/inference/recommendation claim
- counterexample — observation/fact/inference/recommendation label
- alternative — observation/fact/inference/recommendation label
- rights evidence — observation/fact/inference/recommendation label
- validation queue — observation/fact/inference/recommendation label

#### 선택 결과물
- confidence calibration

#### 확장 결과물
- portfolio-safe excerpt boundary

### 파일 구조
- game-design-career/career-foundations/reverse-advanced/content.md
- game-design-career/career-foundations/reverse-advanced/evidence.yml
- game-design-career/career-foundations/reverse-advanced/export-manifest.yml

### 읽는 순서
- game-design-career/career-foundations/reverse-advanced/content.md
- game-design-career/career-foundations/reverse-advanced/evidence.yml
- game-design-career/career-foundations/reverse-advanced/export-manifest.yml

### 도식 바인딩
- ID: ca-s11
- SVG: guides/assets/game-design-career/skills/reverse-engineer-game-design.svg
- PNG: guides/assets/game-design-career/skills/reverse-engineer-game-design.png
- 대체 텍스트: 게임 역기획 직접 호출 흐름

### 사람 검토
#### 승인 경계
reverse-design-critic owner와 evidence-auditor가 falsifiability와 rights를 검토하고 승인 또는 보류한다. approved claim도 내부 사실·기여·합격을 보장하지 않는다.

#### 보류 조건
- rights evidence가 없음
- counterexample·alternative·validation method 중 하나가 없음

#### 안전 경계
모르는 정보는 미정으로 남긴다. 현재 job/company/고용주/공고 facts를 사용할 때만 source URL, retrieval date, as-of date, region, sample scope와 blind spots를 요구한다. Fact, inference, recommendation을 분리하며 경험·기여·채용 확률·적합성·합격을 발명하거나 보장하지 않는다. Reverse engineering은 observation, rule, UI, economy hypothesis, counterexample, rights와 alternative를 포함한다. Do not request API keys, credentials, personal data, or private materials.

### 실패와 재개
```text
reverse-advanced claim, rights evidence와 validation queue를 보존하고 공개 관찰만 추가해 counterexample 검토부터 재개해.
```

</details>
